/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator } from '../schema';
import type {
    FieldsBuildInput,
    FiltersBuildInput,
    PaginationBuildInput,
    RelationsBuildInput,
    SortBuildInput,
} from './parameters';
import {
    FieldsBuilder,
    FiltersCompoundConditionBuilder,
    FiltersConditionBuilder,
    PaginationBuilder,
    RelationsBuilder,
    SortBuilder,
} from './parameters';
import type { IBuilder } from './base';
import type { BuildInput } from './types';
import { Parameter, URLParameter } from '../constants';
import type { ObjectLiteral } from '../types';

type FilterCondition<
    T extends ObjectLiteral,
> = FiltersConditionBuilder<T> | FiltersCompoundConditionBuilder<FilterCondition<T>>;

export class Builder<
    T extends ObjectLiteral = ObjectLiteral,
> implements IBuilder<BuildInput<T>> {
    protected fields : FieldsBuilder<T>;

    protected filters : FiltersCompoundConditionBuilder<FilterCondition<T>>;

    protected pagination: PaginationBuilder;

    protected relations: RelationsBuilder<T>;

    protected sort: SortBuilder<T>;

    // --------------------------------------------------

    constructor() {
        this.fields = new FieldsBuilder<T>();
        this.filters = new FiltersCompoundConditionBuilder<FilterCondition<T>>(FilterCompoundOperator.OR, []);
        this.pagination = new PaginationBuilder();
        this.relations = new RelationsBuilder<T>();
        this.sort = new SortBuilder<T>();
    }

    // --------------------------------------------------

    addRaw(input: BuildInput<T>) {
        if (typeof input[Parameter.FIELDS] !== 'undefined') {
            this.addFields(input[Parameter.FIELDS]);
        }
        if (typeof input[URLParameter.FIELDS] !== 'undefined') {
            this.addFields(input[URLParameter.FIELDS]);
        }

        if (typeof input[Parameter.FILTERS] !== 'undefined') {
            this.addFilters(input[Parameter.FILTERS]);
        }
        if (typeof input[URLParameter.FILTERS] !== 'undefined') {
            this.addFilters(input[URLParameter.FILTERS]);
        }

        if (typeof input[Parameter.PAGINATION] !== 'undefined') {
            this.addPagination(input[Parameter.PAGINATION]);
        }
        if (typeof input[URLParameter.PAGINATION] !== 'undefined') {
            this.addPagination(input[URLParameter.PAGINATION]);
        }

        if (typeof input[Parameter.RELATIONS] !== 'undefined') {
            this.addRelations(input[Parameter.RELATIONS]);
        }
        if (typeof input[URLParameter.RELATIONS] !== 'undefined') {
            this.addRelations(input[URLParameter.RELATIONS]);
        }

        if (typeof input[Parameter.SORT] !== 'undefined') {
            this.addSort(input[Parameter.SORT]);
        }
        if (typeof input[URLParameter.SORT] !== 'undefined') {
            this.addSort(input[URLParameter.SORT]);
        }
    }

    addFields(data: FieldsBuildInput<T>) {
        this.fields.addRaw(data);
    }

    addFilters(
        data: FiltersBuildInput<T> | FilterCondition<T>,
    ) {
        if (
            data instanceof FiltersCompoundConditionBuilder ||
            data instanceof FiltersConditionBuilder
        ) {
            this.filters.add(data as unknown as FilterCondition<T>);
            return;
        }

        const condition = new FiltersConditionBuilder<T>();
        condition.addRaw(data);

        this.filters.add(condition);
    }

    addPagination(data: PaginationBuildInput) {
        this.pagination.addRaw(data);
    }

    addRelations(data: RelationsBuildInput<T>) {
        this.relations.addRaw(data);
    }

    addSort(data: SortBuildInput<T>) {
        this.sort.addRaw(data);
    }

    // --------------------------------------------------

    toString() {
        return this.serialize();
    }

    // --------------------------------------------------

    serialize() {
        const output = [
            this.fields.serialize(),
            this.filters.serialize(),
            this.pagination.serialize(),
            this.relations.serialize(),
            this.sort.serialize(),
        ]
            .filter(Boolean)
            .join('&');

        return output.length > 0 ?
            `?${output}` :
            '';
    }
}
