/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery } from '@rapiq/core';
import { AdapterError, isGroupedQuery } from '@rapiq/core';
import type { ExecuteOptions, IRootAdapter } from '@rapiq/adapter-sql';
import { QueryVisitor, buildGroupedClauses, normalizeGroupedRows } from '@rapiq/adapter-sql';
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

    constructor(options: TypeormAdapterOptions) {
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
     * after the joins.
     */
    executeGrouped(
        query: IQuery,
        options: ExecuteOptions = {},
    ) : TypeormGroupedOutput {
        if (!isGroupedQuery(query)) {
            throw AdapterError.featureUnsupported('groups:empty');
        }

        if (options.clear ?? true) {
            this.clear();
        }

        const clauses = buildGroupedClauses(
            query,
            this.filters,
            resolveQueryDialect(this.queryBuilder).bucket,
        );

        const visitor = new QueryVisitor(this, { caseSensitive: options.caseSensitive });
        query.filters.accept(visitor.filters);
        query.pagination.accept(visitor.pagination);

        // joins run before the select list and the GROUP BY are
        // rebuilt below: select([]) drops the columns a hydrating join
        // added, and groupBy() drops an onJoin hook's addGroupBy (a
        // per-entity dedupe), so neither can change the grain.
        this.relations.execute();

        this.queryBuilder.select([]);
        for (const select of clauses.selects) {
            this.queryBuilder.addSelect(select.expression, select.key);
        }

        this.queryBuilder.groupBy();
        for (const expression of clauses.groupBy) {
            this.queryBuilder.addGroupBy(expression);
        }

        this.filters.execute();

        // LIMIT/OFFSET count groups. take/skip would switch typeorm to
        // its two-query entity pagination as soon as anything is joined.
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
}
