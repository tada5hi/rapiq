/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DialectOptions } from '../dialect';
import type { IRootAdapter } from './types';
import { FieldsAdapter } from './fields';
import { FiltersAdapter } from './filters';
import { PaginationBaseAdapter } from './pagination';
import { RelationsAdapter } from './relations';
import { SortAdapter } from './sort';

export type AdapterOptions = DialectOptions;

export class Adapter<
    QUERY extends Record<string, any> = Record<string, any>,
> implements IRootAdapter<QUERY> {
    public readonly relations : RelationsAdapter<QUERY>;

    public readonly fields : FieldsAdapter<QUERY>;

    public readonly filters : FiltersAdapter<QUERY>;

    public readonly pagination : PaginationBaseAdapter<QUERY>;

    public readonly sort : SortAdapter<QUERY>;

    protected query : QUERY | undefined;
    // -----------------------------------------------------------

    constructor(options: AdapterOptions) {
        this.relations = new RelationsAdapter<QUERY>({
            join: () => true,
        });
        this.fields = new FieldsAdapter(this.relations, {
            escapeField: options.escapeField,
        });

        this.filters = new FiltersAdapter(this.relations, {
            paramPlaceholder: options.paramPlaceholder,
            regexp: options.regexp,
            escapeField: options.escapeField,
        });

        this.pagination = new PaginationBaseAdapter<QUERY>();

        this.sort = new SortAdapter(this.relations, {
            escapeField: options.escapeField,
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
        this.relations.clear();
        this.fields.clear();
        this.filters.clear();
        this.pagination.clear();
        this.sort.clear();
    }

    // -----------------------------------------------------------

    // todo: apply all container results to query
    execute() {
        // todo: exclude already applied containers
    }
}
