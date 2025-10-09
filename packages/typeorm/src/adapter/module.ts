/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { PaginationBaseAdapter } from '@rapiq/sql';
import type { IRootAdapter } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';
import { RelationsAdapter } from './relations';
import { FieldsAdapter } from './fields';
import { FiltersAdapter } from './filters';
import { SortAdapter } from './sort';

export class TypeormAdapter<
    QUERY extends SelectQueryBuilder<any> = SelectQueryBuilder<any>,
> implements IRootAdapter<QUERY> {
    public readonly relations : RelationsAdapter<QUERY>;

    public readonly fields : FieldsAdapter<QUERY>;

    public readonly filters : FiltersAdapter<QUERY>;

    public readonly pagination : PaginationBaseAdapter<QUERY>;

    public readonly sort : SortAdapter<QUERY>;

    protected query : QUERY | undefined;

    constructor() {
        this.relations = new RelationsAdapter<QUERY>();
        this.fields = new FieldsAdapter<QUERY>(this.relations);
        this.filters = new FiltersAdapter<QUERY>(this.relations);
        this.pagination = new PaginationBaseAdapter<QUERY>();
        this.sort = new SortAdapter<QUERY>(this.relations);
    }

    withQuery(query?: QUERY) {
        this.query = query;

        this.relations.withQuery(query);
        this.fields.withQuery(query);
        this.filters.withQuery(query);
        this.pagination.withQuery(query);
        this.sort.withQuery(query);
    }

    clear() {
        this.fields.clear();
        this.filters.clear();
        this.pagination.clear();
        this.sort.clear();
        this.relations.clear();
    }

    execute() {
        this.fields.execute();
        this.filters.execute();
        this.pagination.execute();
        this.sort.execute();
        this.relations.execute();
    }
}
