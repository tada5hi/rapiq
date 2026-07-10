/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery } from '@rapiq/core';
import type { ExecuteOptions, IRootAdapter } from '@rapiq/sql';
import { QueryVisitor } from '@rapiq/sql';
import { RelationsAdapter } from './relations';
import { FieldsAdapter } from './fields';
import { FiltersAdapter } from './filters';
import { SortAdapter } from './sort';
import type { TypeormAdapterOptions, TypeormAdapterOutput } from './types';
import { PaginationAdapter } from './pagination';

export class TypeormAdapter implements IRootAdapter<TypeormAdapterOutput> {
    public readonly relations : RelationsAdapter;

    public readonly fields : FieldsAdapter;

    public readonly filters : FiltersAdapter;

    public readonly pagination : PaginationAdapter;

    public readonly sort : SortAdapter;

    constructor(options: TypeormAdapterOptions) {
        this.relations = new RelationsAdapter(options.queryBuilder, options.relations);
        this.fields = new FieldsAdapter(options.queryBuilder, this.relations);
        this.filters = new FiltersAdapter(options.queryBuilder, this.relations);
        this.pagination = new PaginationAdapter(options.queryBuilder);
        this.sort = new SortAdapter(options.queryBuilder, this.relations);
    }

    clear() {
        this.fields.clear();
        this.filters.clear();
        this.pagination.clear();
        this.sort.clear();
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
        if (options.clear ?? true) {
            this.clear();
        }

        query.accept(new QueryVisitor(this, options.visitor));

        this.fields.execute();
        this.filters.execute();
        this.pagination.execute();
        this.sort.execute();
        this.relations.execute();

        return {
            pagination: {
                limit: this.pagination.limit,
                offset: this.pagination.offset,
            },
        };
    }
}
