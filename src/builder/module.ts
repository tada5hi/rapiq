/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator } from '../schema';
import type {
    FieldsBuildInput,
    FiltersBuildInput, FiltersCompoundConditionBuilderArg,
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
import type { BuildInput, IBuilder } from './types';
import { Parameter, URLParameter } from '../constants';
import type { ObjectLiteral } from '../types';

export class Builder<
    T extends ObjectLiteral = ObjectLiteral,
> implements IBuilder<BuildInput<T>> {
    protected fields : FieldsBuilder<T>;

    protected filters : FiltersCompoundConditionBuilder<FiltersCompoundConditionBuilderArg<T>>;

    protected pagination: PaginationBuilder;

    protected relations: RelationsBuilder<T>;

    protected sort: SortBuilder<T>;

    // --------------------------------------------------

    constructor() {
        this.fields = new FieldsBuilder<T>();
        this.filters = new FiltersCompoundConditionBuilder<
        FiltersCompoundConditionBuilderArg<T>
        >(FilterCompoundOperator.OR, []);
        this.pagination = new PaginationBuilder();
        this.relations = new RelationsBuilder<T>();
        this.sort = new SortBuilder<T>();
    }

    // --------------------------------------------------

    clear() {
        return this.clearFields()
            .clearFilters()
            .clearPagination()
            .clearRelations()
            .clearSort();
    }

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

    // --------------------------------------------------------

    clearFields() {
        this.fields.clear();

        return this;
    }

    addFields(data: FieldsBuildInput<T>) {
        this.fields.addRaw(data);

        return this;
    }

    withFields(data: FieldsBuildInput<T>) {
        this.clearFields().addFields(data);

        return this;
    }

    setFieldsBuilder(instance: FieldsBuilder<T>) {
        this.fields = instance;

        return this;
    }

    getFieldsBuilder(): FieldsBuilder<T> {
        return this.fields;
    }

    // --------------------------------------------------------

    clearFilters() {
        this.filters.clear();
        return this;
    }

    addFilters(
        data: FiltersBuildInput<T> | FiltersCompoundConditionBuilderArg<T>,
    ) {
        if (
            data instanceof FiltersCompoundConditionBuilder ||
            data instanceof FiltersConditionBuilder
        ) {
            this.filters.add(data);
            return this;
        }

        const condition = new FiltersConditionBuilder<T>();
        condition.addRaw(data);

        this.filters.add(condition);

        return this;
    }

    withFilters(
        data: FiltersBuildInput<T> | FiltersCompoundConditionBuilderArg<T>,
    ) {
        this.clearFilters().addFilters(data);

        return this;
    }

    setFiltersBuilder(instance: FiltersCompoundConditionBuilder<FiltersCompoundConditionBuilderArg<T>>) {
        this.filters = instance;

        return this;
    }

    getFiltersBuilder(): FiltersCompoundConditionBuilder<FiltersCompoundConditionBuilderArg<T>> {
        return this.filters;
    }

    // --------------------------------------------------------

    clearPagination() {
        this.pagination.clear();
        return this;
    }

    addPagination(data: PaginationBuildInput) {
        this.pagination.addRaw(data);

        return this;
    }

    withPagination(data: PaginationBuildInput) {
        this.clearPagination().addPagination(data);
        return this;
    }

    setPaginationBuilder(data: PaginationBuilder) {
        this.pagination = data;
        return this;
    }

    getPaginationBuilder(): PaginationBuilder {
        return this.pagination;
    }

    // --------------------------------------------------------

    clearRelations() {
        this.relations.clear();
        return this;
    }

    addRelations(data: RelationsBuildInput<T>) {
        this.relations.addRaw(data);
        return this;
    }

    withRelations(data: RelationsBuildInput<T>) {
        this.clearRelations().addRelations(data);
        return this;
    }

    setRelationsBuilder(instance: RelationsBuilder<T>) {
        this.relations = instance;
        return this;
    }

    getRelationsBuilder(): RelationsBuilder<T> {
        return this.relations;
    }

    // --------------------------------------------------------

    clearSort() {
        this.sort.clear();
        return this;
    }

    addSort(data: SortBuildInput<T>) {
        this.sort.addRaw(data);
        return this;
    }

    withSort(data: SortBuildInput<T>) {
        this.clearSort().addSort(data);
    }

    setSortBuilder(instance: SortBuilder<T>) {
        this.sort = instance;
        return this;
    }

    getSortBuilder(): SortBuilder<T> {
        return this.sort;
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
