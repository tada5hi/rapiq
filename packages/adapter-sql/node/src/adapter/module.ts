/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery } from '@rapiq/core';
import { AdapterError, isGroupedQuery } from '@rapiq/core';
import { QueryVisitor } from '../visitor';
import type { DialectOptions } from '../dialect';
import type { RelationAliasFn } from '../helpers';
import type {
    ExecuteOptions,
    GroupedSqlFragments,
    IRootAdapter,
    SqlFragments,
} from './types';
import { FieldsAdapter } from './fields';
import { FiltersAdapter } from './filters';
import { buildGroupedClauses } from './grouped';
import { PaginationAdapter } from './pagination';
import { RelationsAdapter } from './relations';
import { SortsAdapter } from './sort';

export type AdapterOptions = DialectOptions & {
    rootAlias?: string,

    /**
     * Derive the join alias for a relation path
     * (default: length-prefixed segments, e.g. `role.realm` ->
     * `r4_role_5_realm`).
     */
    relationAlias?: RelationAliasFn,
};

export class Adapter implements IRootAdapter<SqlFragments> {
    public readonly relations : RelationsAdapter;

    public readonly fields : FieldsAdapter;

    public readonly filters : FiltersAdapter;

    public readonly pagination : PaginationAdapter;

    public sorts : SortsAdapter;

    protected readonly options : AdapterOptions;

    // -----------------------------------------------------------

    constructor(options: AdapterOptions) {
        this.options = options;

        this.relations = new RelationsAdapter({
            join: () => true,
            relationAlias: options.relationAlias,
        });
        this.fields = new FieldsAdapter(this.relations, {
            escapeField: options.escapeField,
            rootAlias: options.rootAlias,
        });

        // forward the full DialectOptions rather than hand-picking known
        // members: FiltersContainerOptions is `{ rootAlias? } & DialectOptions`,
        // so a hand-picked subset silently drops any option added later
        // (this is how `mod` went missing here while `FiltersAdapter`
        // itself supported it all along).
        this.filters = new FiltersAdapter(this.relations, options);

        this.pagination = new PaginationAdapter();

        this.sorts = new SortsAdapter(this.relations, {
            escapeField: options.escapeField,
            rootAlias: options.rootAlias,
        });
    }

    // -----------------------------------------------------------

    /**
     * @deprecated use {@link Adapter.sorts}. Removed in 3.0.
     */
    get sort() : SortsAdapter {
        return this.sorts;
    }

    /**
     * @deprecated use {@link Adapter.sorts}. Removed in 3.0.
     */
    set sort(value: SortsAdapter) {
        this.sorts = value;
    }

    // -----------------------------------------------------------

    clear() {
        this.fields.clear();
        this.filters.clear();
        this.pagination.clear();
        this.sorts.clear();
        this.relations.clear();
    }

    // -----------------------------------------------------------

    /**
     * Walk `query` into the sub-adapters and collect the accumulated
     * clause fragments. Plain SQL has no backend target — it returns the
     * fragments for the caller to assemble.
     */
    execute(query: IQuery, options: ExecuteOptions = {}) : SqlFragments {
        // a grouped query returns aggregated rows, never records; the
        // record fragments would silently drop the grain.
        if (isGroupedQuery(query)) {
            throw AdapterError.featureUnsupported('groups');
        }

        if (options.clear ?? true) {
            this.clear();
        }

        query.accept(new QueryVisitor(this, { caseSensitive: options.caseSensitive }));

        const [where, params] = this.filters.getQueryAndParameters();

        return {
            columns: this.fields.getColumns(),
            where,
            params,
            orderBy: this.sorts.getOrderBy(),
            limit: this.pagination.limit,
            offset: this.pagination.offset,
            relations: this.relations.getPaths(),
        };
    }

    /**
     * Walk a grouped query (groups and/or aggregates) into clause
     * fragments. Relations are joined only as far as a filter traverses
     * them and are never hydrated: a hydration join of a to-many
     * relation would multiply every aggregate. A filter across a to-many
     * relation still joins it; the caller owns the join and may render
     * it as a semi-join instead.
     */
    executeGrouped(query: IQuery, options: ExecuteOptions = {}) : GroupedSqlFragments {
        if (options.clear ?? true) {
            this.clear();
        }

        const clauses = buildGroupedClauses(query, this.filters, this.options.bucket);

        const visitor = new QueryVisitor(this, { caseSensitive: options.caseSensitive });
        query.filters.accept(visitor.filters);
        query.pagination.accept(visitor.pagination);

        const [where, params] = this.filters.getQueryAndParameters();
        const { escapeField } = this.options;

        return {
            columns: clauses.selects.map((select) => `${select.expression} as ${escapeField(select.key)}`),
            where,
            params,
            groupBy: clauses.groupBy,
            orderBy: clauses.orderBy.map((item) => `${escapeField(item.key)} ${item.direction}`),
            limit: this.pagination.limit,
            offset: this.pagination.offset,
            relations: this.relations.getPaths(),
        };
    }
}
