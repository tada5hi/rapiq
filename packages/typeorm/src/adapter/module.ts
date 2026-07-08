/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery } from '@rapiq/core';
import type { ExecuteOptions, IRootAdapter } from '@rapiq/sql';
import { QueryVisitor } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';
import { RelationsAdapter } from './relations';
import { FieldsAdapter } from './fields';
import { FiltersAdapter } from './filters';
import { SortAdapter } from './sort';
import type { TypeormAdapterOptions, TypeormAdapterOutput } from './types';
import { PaginationAdapter } from './pagination';

export class TypeormAdapter<
    TARGET extends SelectQueryBuilder<any> = SelectQueryBuilder<any>,
> implements IRootAdapter<TARGET, TypeormAdapterOutput> {
    public readonly relations : RelationsAdapter<TARGET>;

    public readonly fields : FieldsAdapter<TARGET>;

    public readonly filters : FiltersAdapter<TARGET>;

    public readonly pagination : PaginationAdapter<TARGET>;

    public readonly sort : SortAdapter<TARGET>;

    constructor(options: TypeormAdapterOptions<TARGET> = {}) {
        this.relations = new RelationsAdapter<TARGET>(options.relations);
        this.fields = new FieldsAdapter<TARGET>(this.relations);
        this.filters = new FiltersAdapter<TARGET>(this.relations);
        this.pagination = new PaginationAdapter<TARGET>();
        this.sort = new SortAdapter<TARGET>(this.relations);
    }

    protected setTarget(target?: TARGET) {
        this.relations.setTarget(target);
        this.fields.setTarget(target);
        this.filters.setTarget(target);
        this.pagination.setTarget(target);
        this.sort.setTarget(target);
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
     * to the target query builder.
     */
    execute(
        query: IQuery,
        target?: TARGET,
        options: ExecuteOptions = {},
    ) : TypeormAdapterOutput {
        if (options.clear ?? true) {
            this.clear();
        }

        this.setTarget(target);

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
