/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { BuildInput } from './type';
import { DEFAULT_ID, Parameter, URLParameter } from '../constants';
import type {
    FieldsBuildInput,
    FiltersBuildInput,
    PaginationBuildInput,
    RelationsBuildInput,
    SortBuildInput,
} from '../parameter';
import {
    SortDirection,

    transformFiltersBuildInput,
    transformSortBuildInput,
} from '../parameter';
import type { ObjectLiteral } from '../type';
import {
    groupArrayByKeyPath, merge, serializeAsURI, toKeyPathArray,
} from '../utils';

export class QueryBuilder<T extends ObjectLiteral = ObjectLiteral> {
    protected fields : Record<string, string[]>;

    protected filters : Record<string, any>;

    protected pagination: PaginationBuildInput;

    protected relations: string[];

    protected sort: Map<string, SortDirection>;

    // --------------------------------------------------

    constructor() {
        this.fields = {};
        this.filters = {};
        this.pagination = {};
        this.relations = [];
        this.sort = new Map<string, SortDirection>();
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
            this.sort.set(keys[i], record[keys[i]]);
        }
    }

    // --------------------------------------------------

    toString() {
        return this.serialize();
    }

    // --------------------------------------------------

    serialize() {
        const output = [
            this.serializeFields(),
            this.serializeFilters(),
            this.serializePagination(),
            this.serializeRelations(),
            this.serializeSort(),
        ]
            .filter(Boolean)
            .join('&');

        if (output.length > 0) {
            return `?${output}`;
        }

        return '';
    }

    serializeFields() : string {
        const keys = Object.keys(this.fields);
        if (
            keys.length === 1 &&
            keys[0] === DEFAULT_ID
        ) {
            return serializeAsURI({
                [URLParameter.FIELDS]: this.fields[DEFAULT_ID],
            });
        }

        return serializeAsURI({
            [URLParameter.FIELDS]: this.fields,
        });
    }

    serializeFilters() : string {
        return serializeAsURI({
            [URLParameter.FILTERS]: this.filters,
        });
    }

    serializePagination() : string {
        return serializeAsURI({
            [URLParameter.PAGINATION]: this.pagination,
        });
    }

    serializeRelations(): string {
        return serializeAsURI({
            [URLParameter.RELATIONS]: this.relations,
        });
    }

    serializeSort() : string {
        const sort = Object.fromEntries(this.sort);
        const sortKeys = Object.keys(sort);
        const sortParts : string[] = [];

        for (let i = 0; i < sortKeys.length; i++) {
            sortParts.push((sort[sortKeys[i]] === SortDirection.DESC ? '-' : '') + sortKeys[i]);
        }

        return serializeAsURI({
            [URLParameter.SORT]: sortParts,
        });
    }
}
