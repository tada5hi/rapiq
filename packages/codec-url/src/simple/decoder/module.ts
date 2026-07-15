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
    SimpleParser,
    SimpleRelationsParser,
    SimpleSortParser,
} from '@rapiq/parser-simple';
import { parse } from 'qs';
import type {
    IFields,
    IFilters,
    IPagination,
    IQuery,
    IRelations,
    ISorts,
    ObjectLiteral,
    ParseParameterOptions,
    ParseQueryOptions,
    SchemaRegistry,
} from '@rapiq/core';
import {
    Parameter,
    isObject,
    isPropertySet,
} from '@rapiq/core';
import { URLParameter } from '../constants';

export class SimpleURLDecoder {
    protected parser : SimpleParser;

    protected fields: SimpleFieldsParser;

    protected filters : SimpleFiltersParser;

    protected pagination : SimplePaginationParser;

    protected relations: SimpleRelationsParser;

    protected sort: SimpleSortParser;

    constructor(input?: SchemaRegistry) {
        this.parser = new SimpleParser(input);

        this.fields = new SimpleFieldsParser(input);
        this.filters = new SimpleFiltersParser(input);
        this.pagination = new SimplePaginationParser(input);
        this.relations = new SimpleRelationsParser(input);
        this.sort = new SimpleSortParser(input);
    }

    /**
     * Decode a query string or an already parsed query object
     * (e.g. an express req.query): the URL wire names are mapped
     * to their canonical parameters and parsed to a query.
     *
     * @param input
     * @param options
     */
    decode(
        input: string | ObjectLiteral,
        options: ParseQueryOptions = {},
    ) : IQuery | null {
        const parsed = typeof input === 'string' ? parse(input) : input;
        if (!isObject(parsed)) {
            return null;
        }

        const mapped : ObjectLiteral = {};

        this.mapParameter(parsed, mapped, URLParameter.FIELDS, Parameter.FIELDS);
        this.mapParameter(parsed, mapped, URLParameter.FILTERS, Parameter.FILTERS);
        this.mapParameter(parsed, mapped, URLParameter.PAGINATION, Parameter.PAGINATION);
        this.mapParameter(parsed, mapped, URLParameter.RELATIONS, Parameter.RELATIONS);
        this.mapParameter(parsed, mapped, URLParameter.SORT, Parameter.SORT);

        return this.parser.parse(mapped, options);
    }

    async decodeAsync(
        input: string | ObjectLiteral,
        options: ParseQueryOptions = {},
    ) : Promise<IQuery | null> {
        const parsed = typeof input === 'string' ? parse(input) : input;
        if (!isObject(parsed)) {
            return null;
        }

        const mapped : ObjectLiteral = {};

        this.mapParameter(parsed, mapped, URLParameter.FIELDS, Parameter.FIELDS);
        this.mapParameter(parsed, mapped, URLParameter.FILTERS, Parameter.FILTERS);
        this.mapParameter(parsed, mapped, URLParameter.PAGINATION, Parameter.PAGINATION);
        this.mapParameter(parsed, mapped, URLParameter.RELATIONS, Parameter.RELATIONS);
        this.mapParameter(parsed, mapped, URLParameter.SORT, Parameter.SORT);

        return this.parser.parseAsync(mapped, options);
    }

    decodeFields(
        input: string,
        options: ParseParameterOptions = {},
    ) : IFields | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.FIELDS]) {
            return this.fields.parse(output[URLParameter.FIELDS], options);
        }

        return this.fields.parse(output, options);
    }

    decodeFilters(
        input: string,
        options: ParseParameterOptions = {},
    ) : IFilters | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.FILTERS]) {
            return this.filters.parse(output[URLParameter.FILTERS], options);
        }

        return this.filters.parse(output, options);
    }

    async decodeFiltersAsync(
        input: string,
        options: ParseParameterOptions = {},
    ) : Promise<IFilters | null> {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.FILTERS]) {
            return this.filters.parseAsync(output[URLParameter.FILTERS], options);
        }

        return this.filters.parseAsync(output, options);
    }

    decodePagination(
        input: string,
        options: ParseParameterOptions = {},
    ) : IPagination | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.PAGINATION]) {
            return this.pagination.parse(output[URLParameter.PAGINATION], options);
        }

        return this.pagination.parse(output, options);
    }

    decodeRelations(
        input: string,
        options: ParseParameterOptions = {},
    ) : IRelations | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.RELATIONS]) {
            return this.relations.parse(output[URLParameter.RELATIONS], options);
        }

        return this.relations.parse(output, options);
    }

    decodeSort(
        input: string,
        options: ParseParameterOptions = {},
    ) : ISorts | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.SORT]) {
            return this.sort.parse(output[URLParameter.SORT], options);
        }

        return this.sort.parse(output, options);
    }

    // --------------------------------------------------

    protected mapParameter(
        input: ObjectLiteral,
        output: ObjectLiteral,
        urlKey: string,
        key: `${Parameter}`,
    ) : void {
        if (isPropertySet(input, urlKey)) {
            output[key] = input[urlKey];
        }
    }
}
