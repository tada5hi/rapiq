/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    FieldsBuildInput, FiltersBuildInput, PaginationBuildInput, RelationsBuildInput, SortBuildInput,
} from './parameters';
import { BaseBuilder } from './base';
import {
    FieldsBuilder,
    FiltersBuilder,
    PaginationBuilder,
    RelationsBuilder,
    SortBuilder,
} from './parameters';
import type { BuildInput } from './types';
import { Parameter, URLParameter } from '../constants';
import type { ObjectLiteral } from '../types';
import {
    serializeAsURI,
} from '../utils';

export class Builder<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseBuilder<BuildInput<T>> {
    protected fields : FieldsBuilder<T>;

    protected filters : FiltersBuilder<T>;

    protected pagination: PaginationBuilder;

    protected relations: RelationsBuilder;

    protected sort: SortBuilder;

    // --------------------------------------------------

    constructor() {
        super();

        this.fields = new FieldsBuilder();
        this.filters = new FiltersBuilder();
        this.pagination = new PaginationBuilder();
        this.relations = new RelationsBuilder();
        this.sort = new SortBuilder();
    }

    // --------------------------------------------------

    add(input: BuildInput<T>) {
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
        this.fields.add(data);
    }

    addFilters(data: FiltersBuildInput<T>) {
        this.filters.add(data);
    }

    addPagination(data: PaginationBuildInput) {
        this.pagination.add(data);
    }

    addRelations(data: RelationsBuildInput<T>) {
        this.relations.add(data);
    }

    addSort(data: SortBuildInput<T>) {
        this.sort.add(data);
    }

    // --------------------------------------------------

    override toString() {
        return this.buildAsURI();
    }

    // --------------------------------------------------

    prepare() {
        const record : Record<string, any> = {};
        const fields = this.fields.prepare();
        if (typeof fields !== 'undefined') {
            record[URLParameter.FIELDS] = fields;
        }

        const filters = this.filters.prepare();
        if (typeof filters !== 'undefined') {
            record[URLParameter.FILTERS] = filters;
        }

        const pagination = this.pagination.prepare();
        if (typeof pagination !== 'undefined') {
            record[URLParameter.PAGINATION] = pagination;
        }

        const relations = this.relations.prepare();
        if (typeof relations !== 'undefined') {
            record[URLParameter.RELATIONS] = relations;
        }

        const sort = this.sort.prepare();
        if (typeof sort !== 'undefined') {
            record[URLParameter.SORT] = sort;
        }

        return record;
    }

    buildAsURI() {
        const output = serializeAsURI(this.prepare());
        return output.length > 0 ?
            `?${output}` :
            '';
    }
}
