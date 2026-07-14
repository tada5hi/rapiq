/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery } from '@rapiq/core';
import { QueryVisitor } from '../visitor';
import type { DialectOptions } from '../dialect';
import type { RelationAliasFn } from '../helpers';
import type {
    ExecuteOptions,
    IRootAdapter,
    SqlFragments,
} from './types';
import { FieldsAdapter } from './fields';
import { FiltersAdapter } from './filters';
import { PaginationAdapter } from './pagination';
import { RelationsAdapter } from './relations';
import { SortAdapter } from './sort';

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

    public readonly sort : SortAdapter;

    // -----------------------------------------------------------

    constructor(options: AdapterOptions) {
        this.relations = new RelationsAdapter({
            join: () => true,
            relationAlias: options.relationAlias,
        });
        this.fields = new FieldsAdapter(this.relations, {
            escapeField: options.escapeField,
            rootAlias: options.rootAlias,
        });

        this.filters = new FiltersAdapter(this.relations, {
            paramPlaceholder: options.paramPlaceholder,
            regexp: options.regexp,
            caseFold: options.caseFold,
            escapeField: options.escapeField,
            rootAlias: options.rootAlias,
        });

        this.pagination = new PaginationAdapter();

        this.sort = new SortAdapter(this.relations, {
            escapeField: options.escapeField,
            rootAlias: options.rootAlias,
        });
    }

    // -----------------------------------------------------------

    clear() {
        this.fields.clear();
        this.filters.clear();
        this.pagination.clear();
        this.sort.clear();
        this.relations.clear();
    }

    // -----------------------------------------------------------

    /**
     * Walk `query` into the sub-adapters and collect the accumulated
     * clause fragments. Plain SQL has no backend target — it returns the
     * fragments for the caller to assemble.
     */
    execute(query: IQuery, options: ExecuteOptions = {}) : SqlFragments {
        if (options.clear ?? true) {
            this.clear();
        }

        query.accept(new QueryVisitor(this, options.visitor));

        const [where, params] = this.filters.getQueryAndParameters();

        return {
            columns: this.fields.getColumns(),
            where,
            params,
            orderBy: this.sort.getOrderBy(),
            limit: this.pagination.limit,
            offset: this.pagination.offset,
            relations: this.relations.getPaths(),
        };
    }
}
