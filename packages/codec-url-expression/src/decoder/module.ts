/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ExpressionFieldsParser,
    ExpressionFiltersParser,
    ExpressionPaginationParser,
    ExpressionParser,
    ExpressionRelationsParser,
    ExpressionSortParser,
} from '@rapiq/parser-expression';
import { URLParameter } from '@rapiq/codec-url-simple';
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

export class URLDecoder {
    protected parser : ExpressionParser;

    protected fields: ExpressionFieldsParser;

    protected filters : ExpressionFiltersParser;

    protected pagination : ExpressionPaginationParser;

    protected relations: ExpressionRelationsParser;

    protected sort: ExpressionSortParser;

    constructor(input?: SchemaRegistry) {
        this.parser = new ExpressionParser(input);

        this.fields = new ExpressionFieldsParser(input);
        this.filters = new ExpressionFiltersParser(input);
        this.pagination = new ExpressionPaginationParser(input);
        this.relations = new ExpressionRelationsParser(input);
        this.sort = new ExpressionSortParser(input);
    }

    /**
     * Decode a query string or an already parsed query object
     * (e.g. an express req.query): the URL wire names are mapped
     * to their canonical parameters and parsed to a query. The
     * filter parameter carries a single expression string
     * (e.g. filter=and(eq(name,'John'),gte(age,'18'))).
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

        // an empty string is NOT absent — the expression dialect is
        // precise, so `filter=` must surface the parser's syntax error
        // instead of falling back to schema defaults.
        if (isPropertySet(output, URLParameter.FILTERS)) {
            return this.filters.parse(output[URLParameter.FILTERS], options);
        }

        return this.filters.parse(undefined, options);
    }

    async decodeFiltersAsync(
        input: string,
        options: ParseParameterOptions = {},
    ) : Promise<IFilters | null> {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (isPropertySet(output, URLParameter.FILTERS)) {
            return this.filters.parseAsync(output[URLParameter.FILTERS], options);
        }

        return this.filters.parseAsync(undefined, options);
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
