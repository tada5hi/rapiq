/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Fields } from '../parameter';
import { FilterCompoundOperator } from '../schema';
import {
    FiltersBuilder,
    PaginationBuilder,
    RelationsBuilder,
    SortBuilder,
    fields,
} from './parameters';
import type { BuildInput, IBuilder } from './types';
import { Parameter } from '../constants';
import type { ObjectLiteral } from '../types';

export class Builder<
    T extends ObjectLiteral = ObjectLiteral,
> implements IBuilder<BuildInput<T>> {
    public fields : Fields;

    public filters : FiltersBuilder<T>;

    public pagination: PaginationBuilder;

    public relations: RelationsBuilder<T>;

    public sort: SortBuilder<T>;

    // --------------------------------------------------

    constructor() {
        this.fields = new Fields();

        this.filters = new FiltersBuilder<T>(
            FilterCompoundOperator.AND,
            [],
        );
        this.pagination = new PaginationBuilder();
        this.relations = new RelationsBuilder<T>();
        this.sort = new SortBuilder<T>();
    }

    // --------------------------------------------------

    clear() {
        this.filters.clear();
        this.pagination.clear();
        this.relations.clear();
        this.sort.clear();
    }

    async addRaw(input: BuildInput<T>) {
        if (typeof input[Parameter.FIELDS] !== 'undefined') {
            const parsed = await fields(input[Parameter.FIELDS]);
            this.fields.mergeWith(parsed);
        }

        if (typeof input[Parameter.FILTERS] !== 'undefined') {
            this.filters.addRaw(input[Parameter.FILTERS]);
        }

        if (typeof input[Parameter.PAGINATION] !== 'undefined') {
            this.pagination.addRaw(input[Parameter.PAGINATION]);
        }

        if (typeof input[Parameter.RELATIONS] !== 'undefined') {
            this.relations.addRaw(input[Parameter.RELATIONS]);
        }

        if (typeof input[Parameter.SORT] !== 'undefined') {
            this.sort.addRaw(input[Parameter.SORT]);
        }
    }

    mergeWith(builder: Builder<T>) {
        this.fields.mergeWith(builder.fields);
        this.filters.mergeWith(builder.filters);
        this.pagination.mergeWith(builder.pagination);
        this.relations.mergeWith(builder.relations);
        this.sort.mergeWith(builder.sort);
    }

    // --------------------------------------------------

    toString() {
        return this.build();
    }

    // --------------------------------------------------

    build() {
        const output = [
            this.fields.build(),
            this.filters.build(),
            this.pagination.build(),
            this.relations.build(),
            this.sort.build(),
        ]
            .filter(Boolean)
            .join('&');

        return output.length > 0 ?
            `?${output}` :
            '';
    }
}
