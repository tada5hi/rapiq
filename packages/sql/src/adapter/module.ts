/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery } from '@rapiq/core';
import { QueryVisitor } from '../visitor';
import type { DialectOptions } from '../dialect';
import type { ExecuteOptions, IRootAdapter, SqlFragments } from './types';
import { FieldsAdapter } from './fields';
import { FiltersAdapter } from './filters';
import { PaginationAdapter } from './pagination';
import { RelationsAdapter } from './relations';
import { SortAdapter } from './sort';

export type AdapterOptions = DialectOptions & {
    rootAlias?: string,
};

export class Adapter<
    TARGET extends Record<string, any> = Record<string, any>,
> implements IRootAdapter<TARGET, SqlFragments> {
    public readonly relations : RelationsAdapter<TARGET>;

    public readonly fields : FieldsAdapter<TARGET>;

    public readonly filters : FiltersAdapter<TARGET>;

    public readonly pagination : PaginationAdapter<TARGET>;

    public readonly sort : SortAdapter<TARGET>;

    // -----------------------------------------------------------

    constructor(options: AdapterOptions) {
        this.relations = new RelationsAdapter<TARGET>({ join: () => true });
        this.fields = new FieldsAdapter(this.relations, {
            escapeField: options.escapeField,
            rootAlias: options.rootAlias,
        });

        this.filters = new FiltersAdapter(this.relations, {
            paramPlaceholder: options.paramPlaceholder,
            regexp: options.regexp,
            escapeField: options.escapeField,
            rootAlias: options.rootAlias,
        });

        this.pagination = new PaginationAdapter<TARGET>();

        this.sort = new SortAdapter(this.relations, {
            escapeField: options.escapeField,
            rootAlias: options.rootAlias,
        });
    }

    // -----------------------------------------------------------

    /**
     * Attach the backend target to every sub-adapter.
     * The plain SQL adapter has no target, so this is a no-op in practice;
     * it exists for backends (e.g. @rapiq/typeorm) that mutate a target.
     */
    protected setTarget(target?: TARGET) {
        this.relations.setTarget(target);
        this.fields.setTarget(target);
        this.filters.setTarget(target);
        this.pagination.setTarget(target);
        this.sort.setTarget(target);
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
     * clause fragments. The plain SQL adapter ignores `target`.
     */
    execute(query: IQuery, target?: TARGET, options: ExecuteOptions = {}) : SqlFragments {
        if (options.clear ?? true) {
            this.clear();
        }

        this.setTarget(target);

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
