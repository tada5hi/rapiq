/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    SimpleFieldsParser,
    SimpleFiltersParser,
    SimplePaginationParser,
    SimpleRelationsParser, SimpleSortParser,
} from '@rapiq/parser-simple';
import { parse } from 'qs';
import type {
    IFields,
    IFilters,
    IPagination,
    IQuery,
    IRelations,
    ISorts,
} from '@rapiq/core';
import {
    Query,
    isObject,
} from '@rapiq/core';
import { URLParameter } from '../constants';

export class URLDecoder {
    protected fields: SimpleFieldsParser;

    protected filters : SimpleFiltersParser;

    protected pagination : SimplePaginationParser;

    protected relations: SimpleRelationsParser;

    protected sort: SimpleSortParser;

    constructor() {
        this.fields = new SimpleFieldsParser();
        this.filters = new SimpleFiltersParser();
        this.pagination = new SimplePaginationParser();
        this.relations = new SimpleRelationsParser();
        this.sort = new SimpleSortParser();
    }

    decode(input: string) : IQuery | null {
        const parsed = parse(input);
        if (!isObject(parsed)) {
            return null;
        }

        const output = new Query();

        if (parsed[URLParameter.FIELDS]) {
            output.fields = this.fields.parse(parsed[URLParameter.FIELDS]);
        }

        if (parsed[URLParameter.FILTERS]) {
            output.filters = this.filters.parse(parsed[URLParameter.FILTERS]);
        }

        if (parsed[URLParameter.PAGINATION]) {
            output.pagination = this.pagination.parse(parsed[URLParameter.PAGINATION]);
        }

        if (parsed[URLParameter.RELATIONS]) {
            output.relations = this.relations.parse(parsed[URLParameter.RELATIONS]);
        }

        if (parsed[URLParameter.SORT]) {
            output.sorts = this.sort.parse(parsed[URLParameter.SORT]);
        }

        return output;
    }

    decodeFields(input: string) : IFields | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.FIELDS]) {
            return this.fields.parse(output[URLParameter.FIELDS]);
        }

        return this.fields.parse(output);
    }

    decodeFilters(input: string) : IFilters | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.FILTERS]) {
            return this.filters.parse(output[URLParameter.FILTERS]);
        }

        return this.filters.parse(output);
    }

    decodePagination(input: string) : IPagination | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.PAGINATION]) {
            return this.pagination.parse(output[URLParameter.PAGINATION]);
        }

        return this.pagination.parse(output);
    }

    decodeRelations(input: string) : IRelations | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.RELATIONS]) {
            return this.relations.parse(output[URLParameter.RELATIONS]);
        }

        return this.relations.parse(output);
    }

    decodeSort(input: string) : ISorts | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.SORT]) {
            return this.sort.parse(output[URLParameter.SORT]);
        }

        return this.sort.parse(output);
    }
}
