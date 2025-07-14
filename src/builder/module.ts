/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator } from '../schema';
import type { FiltersCompoundConditionBuilderArg } from './parameters';
import {
    FieldsBuilder,
    FiltersCompoundConditionBuilder,
    FiltersConditionBuilder,
    PaginationBuilder,
    RelationsBuilder,
    SortBuilder,
} from './parameters';
import type { BuildInput, IBuilder } from './types';
import { Parameter, URLParameter } from '../constants';
import type { ObjectLiteral } from '../types';

export class Builder<
    T extends ObjectLiteral = ObjectLiteral,
> implements IBuilder<BuildInput<T>> {
    public fields : FieldsBuilder<T>;

    public filters : FiltersCompoundConditionBuilder<FiltersCompoundConditionBuilderArg<T>>;

    public pagination: PaginationBuilder;

    public relations: RelationsBuilder<T>;

    public sort: SortBuilder<T>;

    // --------------------------------------------------

    constructor() {
        this.fields = new FieldsBuilder<T>();
        this.filters = new FiltersCompoundConditionBuilder<
        FiltersCompoundConditionBuilderArg<T>
        >(
            FilterCompoundOperator.OR,
            [],
        );
        this.pagination = new PaginationBuilder();
        this.relations = new RelationsBuilder<T>();
        this.sort = new SortBuilder<T>();
    }

    // --------------------------------------------------

    clear() {
        this.fields.clear();
        this.filters.clear();
        this.pagination.clear();
        this.relations.clear();
        this.sort.clear();
    }

    addRaw(input: BuildInput<T>) {
        if (typeof input[Parameter.FIELDS] !== 'undefined') {
            this.fields.addRaw(input[Parameter.FIELDS]);
        }
        if (typeof input[URLParameter.FIELDS] !== 'undefined') {
            this.fields.addRaw(input[URLParameter.FIELDS]);
        }

        if (
            typeof input[Parameter.FILTERS] !== 'undefined' ||
            typeof input[URLParameter.FILTERS] !== 'undefined'
        ) {
            const condition = new FiltersConditionBuilder<T>();
            if (typeof input[Parameter.FILTERS] !== 'undefined') {
                condition.addRaw(input[Parameter.FILTERS]);
            }
            if (typeof input[URLParameter.FILTERS] !== 'undefined') {
                condition.addRaw(input[URLParameter.FILTERS]);
            }

            this.filters.addRaw(condition);
        }

        if (typeof input[Parameter.PAGINATION] !== 'undefined') {
            this.pagination.addRaw(input[Parameter.PAGINATION]);
        }
        if (typeof input[URLParameter.PAGINATION] !== 'undefined') {
            this.pagination.addRaw(input[URLParameter.PAGINATION]);
        }

        if (typeof input[Parameter.RELATIONS] !== 'undefined') {
            this.relations.addRaw(input[Parameter.RELATIONS]);
        }
        if (typeof input[URLParameter.RELATIONS] !== 'undefined') {
            this.relations.addRaw(input[URLParameter.RELATIONS]);
        }

        if (typeof input[Parameter.SORT] !== 'undefined') {
            this.sort.addRaw(input[Parameter.SORT]);
        }
        if (typeof input[URLParameter.SORT] !== 'undefined') {
            this.sort.addRaw(input[URLParameter.SORT]);
        }
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
