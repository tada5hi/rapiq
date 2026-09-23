/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery } from '@rapiq/core';
import { AdapterError, assertGroupedQuery, isGroupedQuery } from '@rapiq/core';
import type { ExecuteOptions, IRootAdapter } from '@rapiq/adapter-sql';
import {
    FiltersVisitor,
    QueryVisitor,
    buildGroupedClauses,
    normalizeGroupedRows,
} from '@rapiq/adapter-sql';
import type { SelectQueryBuilder } from 'typeorm';
import { resolveQueryDialect } from '../dialect';
import { RelationsAdapter } from './relations';
import { FieldsAdapter } from './fields';
import { FiltersAdapter } from './filters';
import { SortsAdapter } from './sort';
import type { TypeormAdapterOptions, TypeormAdapterOutput, TypeormGroupedOutput } from './types';
import { PaginationAdapter } from './pagination';

export class TypeormAdapter implements IRootAdapter<TypeormAdapterOutput> {
    public readonly relations : RelationsAdapter;

    public readonly fields : FieldsAdapter;

    public readonly filters : FiltersAdapter;

    public readonly pagination : PaginationAdapter;

    public sorts : SortsAdapter;

    protected readonly queryBuilder : SelectQueryBuilder<any>;

    protected readonly options : TypeormAdapterOptions;

    constructor(options: TypeormAdapterOptions) {
        this.options = options;
        this.queryBuilder = options.queryBuilder;
        this.relations = new RelationsAdapter(options.queryBuilder, options.relations);
        this.fields = new FieldsAdapter(options.queryBuilder, this.relations);
        this.filters = new FiltersAdapter(options.queryBuilder, this.relations);
        this.pagination = new PaginationAdapter(options.queryBuilder);
        this.sorts = new SortsAdapter(options.queryBuilder, this.relations);
    }

    /**
     * @deprecated use {@link TypeormAdapter.sorts}. Removed in 3.0.
     */
    get sort() : SortsAdapter {
        return this.sorts;
    }

    /**
     * @deprecated use {@link TypeormAdapter.sorts}. Removed in 3.0.
     */
    set sort(value: SortsAdapter) {
        this.sorts = value;
    }

    clear() {
        this.fields.clear();
        this.filters.clear();
        this.pagination.clear();
        this.sorts.clear();
        this.relations.clear();
    }

    /**
     * Walk `query` into the sub-adapters and apply the accumulated state
     * to the queryBuilder query builder (bound at construction).
     */
    execute(
        query: IQuery,
        options: ExecuteOptions = {},
    ) : TypeormAdapterOutput {
        // checked before clear(): a refused query leaves the bound
        // builder exactly as the caller handed it over.
        if (isGroupedQuery(query)) {
            throw AdapterError.featureUnsupported('groups');
        }

        if (options.clear ?? true) {
            this.clear();
        }

        query.accept(new QueryVisitor(this, { caseSensitive: options.caseSensitive }));

        // ordering is load-bearing: fields.execute() calls queryBuilder.select()
        // (which resets the select list), while relations.execute() *appends*
        // join-and-selected relation columns — so fields must run first.
        this.fields.execute();
        this.filters.execute();
        this.pagination.execute();
        this.sorts.execute();
        this.relations.execute();

        return {
            pagination: {
                limit: this.pagination.limit,
                offset: this.pagination.offset,
            },
        };
    }

    /**
     * Apply a grouped query (groups and/or aggregates) to the bound
     * builder: the select list becomes the output keys, the GROUP BY
     * repeats the group expressions, filters narrow the rows with
     * `andWhere`, and pagination counts groups with LIMIT/OFFSET. Run
     * `getRawMany()` afterwards and pass the rows to `normalize`.
     * Included relations are not joined (as in adapter-sql): a to-many
     * hydration join would multiply every aggregate. A relation a filter
     * traverses is joined and never hydrated: the select list is rebuilt
     * after the joins. Filters that traverse a to-many relation are
     * rendered as a correlated `EXISTS` instead, so no join row reaches
     * the grouping.
     */
    executeGrouped(
        query: IQuery,
        options: ExecuteOptions = {},
    ) : TypeormGroupedOutput {
        assertGroupedQuery(query);

        // a caller's GROUP BY (a per-entity dedupe, say) would silently
        // turn every group into a per-entity group. Checked before
        // clear(), so a refused query leaves the builder untouched.
        if (this.queryBuilder.expressionMap.groupBys.length > 0) {
            throw AdapterError.featureUnsupported('groups:builder');
        }

        if (options.clear ?? true) {
            this.clear();
        }

        const clauses = buildGroupedClauses(
            query,
            this.filters,
            resolveQueryDialect(this.queryBuilder).bucket,
        );

        // a to-many join repeats each root row per related row, which
        // inflates count and sum; groups alone only collapse duplicates.
        // A join the caller made is not ours to rewrite. Checked before
        // anything is joined, so a refused query leaves the builder
        // untouched. An entity join (`leftJoin(Entity, alias, condition)`)
        // carries no relation metadata and cannot be classified.
        const aggregated = !!query.aggregates && query.aggregates.value.length > 0;
        if (aggregated && this.hasToManyJoin()) {
            throw AdapterError.featureUnsupported('aggregates:fan-out');
        }

        // the query's filters go to the subquery or to this adapter, never
        // both: state accumulated here under `clear: false` still applies
        // to the bound builder below.
        const exists = this.buildExistsFilter(query, options);

        const visitor = new QueryVisitor(this, { caseSensitive: options.caseSensitive });
        if (!exists) {
            query.filters.accept(visitor.filters);
        }
        query.pagination.accept(visitor.pagination);

        // joins run before the select list and the GROUP BY are
        // rebuilt below: select([]) drops the columns a hydrating join
        // added, and groupBy() drops an onJoin hook's addGroupBy (a
        // per-entity dedupe), so neither can change the grain.
        this.relations.execute();

        // an onJoin hook may itself have joined a to-many relation.
        if (aggregated && this.hasToManyJoin()) {
            throw AdapterError.featureUnsupported('aggregates:fan-out');
        }

        this.queryBuilder.select([]);
        for (const select of clauses.selects) {
            this.queryBuilder.addSelect(select.expression, select.key);
        }

        this.queryBuilder.groupBy();
        for (const expression of clauses.groupBy) {
            this.queryBuilder.addGroupBy(expression);
        }

        this.filters.execute();

        if (exists) {
            this.queryBuilder.andWhereExists(exists);
        }

        // LIMIT/OFFSET count groups. take/skip would switch typeorm to
        // its two-query entity pagination as soon as anything is joined,
        // and a caller's own paging would cap the groups: only the
        // query's pagination applies.
        this.queryBuilder.take(undefined).skip(undefined);
        this.queryBuilder.limit(undefined).offset(undefined);

        if (typeof this.pagination.limit !== 'undefined') {
            this.queryBuilder.limit(this.pagination.limit);
        }

        if (typeof this.pagination.offset !== 'undefined') {
            this.queryBuilder.offset(this.pagination.offset);
        }

        // typeorm resolves a key equal to a select alias and escapes it.
        this.queryBuilder.orderBy();
        for (const sort of clauses.orderBy) {
            this.queryBuilder.addOrderBy(sort.key, sort.direction);
        }

        return {
            pagination: {
                limit: this.pagination.limit,
                offset: this.pagination.offset,
            },
            normalize: (rows) => normalizeGroupedRows(query, rows),
        };
    }

    /**
     * A root row matches a filter across a to-many relation when one of
     * its join rows satisfies the whole tree, so such a tree is rendered
     * into a builder of its own over the root entity, correlated with the
     * bound builder on every primary key column, for `andWhereExists`:
     * no join row reaches the grouping. One rule for every grouped query,
     * aggregates or not: the answer is the same, and groups alone no
     * longer join rows only to collapse them again. The joins the filters
     * need and the onJoin hooks (a tenant or authorization condition on a
     * joined relation, say) apply inside it, with the same relations
     * options. Undefined for a tree without to-many traversal: a to-one
     * join repeats no row, so it stays a plain join on the bound builder.
     */
    protected buildExistsFilter(query: IQuery, options: ExecuteOptions) : SelectQueryBuilder<any> | undefined {
        const { expressionMap } = this.queryBuilder;
        if (!expressionMap.mainAlias || !expressionMap.mainAlias.hasMetadata) {
            return undefined;
        }

        const { alias } = this.queryBuilder;
        const { metadata } = expressionMap.mainAlias;
        const subAlias = `${alias}_exists`;

        // seeded with the bound builder's parameters, the filters below
        // pick a namespace no parameter already there uses: they are
        // merged into that builder by andWhereExists.
        const queryBuilder = this.queryBuilder.createQueryBuilder()
            .from(metadata.target, subAlias)
            .setParameters(this.queryBuilder.getParameters());

        const relations = new RelationsAdapter(queryBuilder, this.options.relations);
        const filters = new FiltersAdapter(queryBuilder, relations);
        query.filters.accept(new FiltersVisitor(filters, { caseSensitive: options.caseSensitive }));

        if (!relations.joinsToMany()) {
            return undefined;
        }

        // typeorm reads it when it joins, and for the main alias.
        if (expressionMap.withDeleted) {
            queryBuilder.withDeleted();
        }

        relations.execute();

        // after the joins, so a hook calling where() cannot drop it.
        for (const column of metadata.primaryColumns) {
            const name = queryBuilder.escape(column.databaseName);
            queryBuilder.andWhere(`${queryBuilder.escape(subAlias)}.${name} = ${queryBuilder.escape(alias)}.${name}`);
        }

        filters.execute();

        return queryBuilder;
    }

    protected hasToManyJoin() : boolean {
        return this.queryBuilder.expressionMap.joinAttributes.some(
            (join) => !!join.relation &&
                (join.relation.isOneToMany || join.relation.isManyToMany),
        );
    }
}
