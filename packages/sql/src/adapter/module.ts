/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DialectOptions } from '../dialect';
import type { IRootAdapter, SqlFragments } from './types';
import { FieldsAdapter } from './fields';
import { FiltersAdapter } from './filters';
import { PaginationAdapter } from './pagination';
import { RelationsAdapter } from './relations';
import { SortAdapter } from './sort';

export type AdapterOptions = DialectOptions & {
    rootAlias?: string,
};

export class Adapter<
    QUERY extends Record<string, any> = Record<string, any>,
> implements IRootAdapter<QUERY> {
    public readonly relations : RelationsAdapter<QUERY>;

    public readonly fields : FieldsAdapter<QUERY>;

    public readonly filters : FiltersAdapter<QUERY>;

    public readonly pagination : PaginationAdapter<QUERY>;

    public readonly sort : SortAdapter<QUERY>;

    protected query : QUERY | undefined;
    // -----------------------------------------------------------

    constructor(options: AdapterOptions) {
        this.relations = new RelationsAdapter<QUERY>({ join: () => true });
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

        this.pagination = new PaginationAdapter<QUERY>();

        this.sort = new SortAdapter(this.relations, {
            escapeField: options.escapeField,
            rootAlias: options.rootAlias,
        });
    }

    // -----------------------------------------------------------

    withQuery(query?: QUERY) {
        this.query = query;

        this.relations.withQuery(query);
        this.fields.withQuery(query);
        this.filters.withQuery(query);
        this.pagination.withQuery(query);
        this.sort.withQuery(query);
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
     * Collect the accumulated clause fragments of every sub-adapter.
     */
    build() : SqlFragments {
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

    /**
     * Plain SQL fragments are consumed via {@link build};
     * execute() exists for backend adapters (e.g. @rapiq/typeorm)
     * that apply the accumulated state to a query object.
     */
    execute() {
        this.fields.execute();
        this.filters.execute();
        this.pagination.execute();
        this.sort.execute();
        this.relations.execute();
    }
}
