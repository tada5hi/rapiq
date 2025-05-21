/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    FieldsBuildInput, FiltersBuildInput, PaginationBuildInput, RelationsBuildInput, SortBuildInput,
} from '../../builder';
import type { BuildInput } from './types';
import { DEFAULT_ID, Parameter, URLParameter } from '../../constants';
import {
    SortDirection,

    transformFiltersBuildInput,
    transformSortBuildInput,
} from '../../schema/parameter';
import type { ObjectLiteral } from '../../types';
import {
    groupArrayByKeyPath, merge, serializeAsURI, toKeyPathArray,
} from '../../utils';

export class QueryBuilder<T extends ObjectLiteral = ObjectLiteral> {
    protected fields : Record<string, string[]>;

    protected filters : Record<string, any>;

    protected pagination: PaginationBuildInput;

    protected relations: string[];

    protected sort: Record<string, SortDirection>;

    // --------------------------------------------------

    constructor() {
        this.fields = {};
        this.filters = {};
        this.pagination = {};
        this.relations = [];
        this.sort = {};
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
        this.fields = merge(this.fields, groupArrayByKeyPath(toKeyPathArray(data)));
    }

    addFilters(data: FiltersBuildInput<T>) {
        this.filters = merge(this.filters, transformFiltersBuildInput(data));
    }

    addPagination(data: PaginationBuildInput) {
        this.pagination = merge(this.pagination, data);
    }

    addRelations(data: RelationsBuildInput<T>) {
        this.relations = merge(this.relations, toKeyPathArray(data));
    }

    addSort(data: SortBuildInput<T>) {
        const record = transformSortBuildInput(data);
        const keys = Object.keys(record);
        for (let i = 0; i < keys.length; i++) {
            this.sort[keys[i]] = record[keys[i]];
        }
    }

    // --------------------------------------------------

    toString() {
        return this.build();
    }

    // --------------------------------------------------

    build() {
        const record : Record<string, any> = {};

        let keys : string[];

        keys = Object.keys(this.fields);
        if (keys.length > 0) {
            if (
                keys.length === 1 &&
                keys[0] === DEFAULT_ID
            ) {
                record[URLParameter.FIELDS] = this.fields[DEFAULT_ID];
            } else {
                record[URLParameter.FIELDS] = this.fields;
            }
        }

        keys = Object.keys(this.filters);
        if (keys.length > 0) {
            record[URLParameter.FILTERS] = this.filters;
        }

        keys = Object.keys(this.pagination);
        if (keys.length > 0) {
            record[URLParameter.PAGINATION] = this.pagination;
        }

        if (this.relations.length > 0) {
            record[URLParameter.RELATIONS] = this.relations;
        }

        keys = Object.keys(this.sort);
        if (keys.length > 0) {
            const parts : string[] = [];

            for (let i = 0; i < keys.length; i++) {
                parts.push((this.sort[keys[i]] === SortDirection.DESC ? '-' : '') + keys[i]);
            }

            record[URLParameter.SORT] = parts;
        }

        const output = serializeAsURI(record);
        return output.length > 0 ?
            `?${output}` :
            '';
    }
}
