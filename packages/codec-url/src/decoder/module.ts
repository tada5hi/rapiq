/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { parse } from 'qs';
import type {
    BaseQueryParser,
    IFields,
    IFilters,
    IPagination,
    IQuery,
    IRelations,
    ISorts,
    ObjectLiteral,
    ParseParameterOptions,
    ParseQueryOptions,
} from '@rapiq/core';
import {
    Parameter,
    isObject,
    isPropertySet,
} from '@rapiq/core';
import { URLParameter } from '../constants';

/**
 * Wire name → canonical parameter of the shared URL grammar.
 */
const URL_PARAMETER_MAP = [
    [URLParameter.FIELDS, Parameter.FIELDS],
    [URLParameter.FILTERS, Parameter.FILTERS],
    [URLParameter.PAGINATION, Parameter.PAGINATION],
    [URLParameter.RELATIONS, Parameter.RELATIONS],
    [URLParameter.SORT, Parameter.SORT],
] as const;

/**
 * Shared decode pipeline of the URL dialects: qs-parse the input,
 * map the wire names to their canonical parameters and delegate to
 * the dialect's query parser. Only the filter parameter differs per
 * dialect (see {@link BaseURLDecoder.filtersFallback}).
 */
export abstract class BaseURLDecoder {
    protected parser : BaseQueryParser;

    protected constructor(parser: BaseQueryParser) {
        this.parser = parser;
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
        const mapped = this.prepare(input);
        if (!mapped) {
            return null;
        }

        return this.parser.parse(mapped, options);
    }

    async decodeAsync(
        input: string | ObjectLiteral,
        options: ParseQueryOptions = {},
    ) : Promise<IQuery | null> {
        const mapped = this.prepare(input);
        if (!mapped) {
            return null;
        }

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

        if (isPropertySet(output, URLParameter.FIELDS)) {
            return this.parser.parseFields(output[URLParameter.FIELDS], options);
        }

        return this.parser.parseFields(output, options);
    }

    decodeFilters(
        input: string,
        options: ParseParameterOptions = {},
    ) : IFilters | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        // a present-but-empty parameter (`filter=`) is still present —
        // it must reach the dialect's parser instead of pulling the
        // whole payload in as filter input.
        if (isPropertySet(output, URLParameter.FILTERS)) {
            return this.parser.parseFilters(output[URLParameter.FILTERS], options);
        }

        return this.parser.parseFilters(this.filtersFallback(output), options);
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
            return this.parser.parseFiltersAsync(output[URLParameter.FILTERS], options);
        }

        return this.parser.parseFiltersAsync(this.filtersFallback(output), options);
    }

    decodePagination(
        input: string,
        options: ParseParameterOptions = {},
    ) : IPagination | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (isPropertySet(output, URLParameter.PAGINATION)) {
            return this.parser.parsePagination(output[URLParameter.PAGINATION], options);
        }

        return this.parser.parsePagination(output, options);
    }

    decodeRelations(
        input: string,
        options: ParseParameterOptions = {},
    ) : IRelations | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (isPropertySet(output, URLParameter.RELATIONS)) {
            return this.parser.parseRelations(output[URLParameter.RELATIONS], options);
        }

        return this.parser.parseRelations(output, options);
    }

    decodeSort(
        input: string,
        options: ParseParameterOptions = {},
    ) : ISorts | null {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (isPropertySet(output, URLParameter.SORT)) {
            return this.parser.parseSort(output[URLParameter.SORT], options);
        }

        return this.parser.parseSort(output, options);
    }

    // --------------------------------------------------

    /**
     * Filter input when the filter wire parameter is absent.
     * The simple dialect reads the whole payload as filter input;
     * the expression dialect overrides this with `undefined` so
     * schema defaults apply.
     *
     * @param output
     */
    protected filtersFallback(output: ObjectLiteral) : unknown {
        return output;
    }

    protected prepare(input: string | ObjectLiteral) : ObjectLiteral | null {
        const parsed = typeof input === 'string' ? parse(input) : input;
        if (!isObject(parsed)) {
            return null;
        }

        const mapped : ObjectLiteral = {};

        for (const [urlKey, key] of URL_PARAMETER_MAP) {
            if (isPropertySet(parsed, urlKey)) {
                mapped[key] = parsed[urlKey];
            }
        }

        return mapped;
    }
}
