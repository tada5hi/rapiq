/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { Parameter, URLParameter } from '../constants';
import type {
    Fields, Filters, Pagination, Query, Relations,
    Sorts,
} from '../parameter';
import { BaseParser } from './base';
import {
    SimpleFieldsParser,
    SimpleFiltersParser,
    SimplePaginationParser,
    SimpleRelationsParser,
    SimpleSortParser,
} from './parameter';
import type { ObjectLiteral } from '../types';
import { isObject, isPropertySet } from '../utils';
import type {
    ParseOptions, ParseParameterOptions,
} from './types';
import type { SchemaRegistry } from '../schema';

export class SimpleParser extends BaseParser<
ParseOptions,
Query
> {
    protected fieldsParser : SimpleFieldsParser;

    protected filtersParser : SimpleFiltersParser;

    protected paginationParser : SimplePaginationParser;

    protected relationsParser : SimpleRelationsParser;

    protected sortParser : SimpleSortParser;

    // -----------------------------------------------------

    constructor(input?: SchemaRegistry) {
        super(input);

        this.fieldsParser = new SimpleFieldsParser(this.registry);
        this.filtersParser = new SimpleFiltersParser(this.registry);
        this.paginationParser = new SimplePaginationParser(this.registry);
        this.relationsParser = new SimpleRelationsParser(this.registry);
        this.sortParser = new SimpleSortParser(this.registry);
    }

    // -----------------------------------------------------

    async parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseOptions<RECORD> = {},
    ): Promise<Query> {
        const schema = this.getBaseSchema(options.schema);

        const output : Query = {};

        if (!isObject(input)) {
            return output;
        }

        const parameterOptions : ParseParameterOptions<RECORD> = {
            schema,
        };

        if (!this.skipParameter(options.relations)) {
            let relations: Relations | undefined;

            if (this.hasParameterData(input, [Parameter.RELATIONS, URLParameter.RELATIONS])) {
                // todo: parse parameter & url-parameter
                relations = await this.parseRelations(
                    input[Parameter.RELATIONS] || input[URLParameter.RELATIONS],
                );
            }

            if (typeof relations !== 'undefined') {
                output[Parameter.RELATIONS] = relations;
                parameterOptions.relations = relations;
            }
        }

        if (!this.skipParameter(options.fields)) {
            let fields : Fields | undefined;

            if (this.hasParameterData(input, [Parameter.FIELDS, URLParameter.FIELDS])) {
                // todo: parse parameter & url-parameter
                fields = await this.parseFields(
                    input[Parameter.FIELDS] || input[URLParameter.FIELDS],
                    parameterOptions,
                );
            } else if (schema.fields.hasDefaults()) {
                // todo: this should be simplified
                fields = await this.parseFields(
                    undefined,
                    parameterOptions,
                );
            }

            if (typeof fields !== 'undefined') {
                output[Parameter.FIELDS] = fields;
            }
        }

        if (!this.skipParameter(options.filters)) {
            let filters : Filters | undefined;
            if (this.hasParameterData(input, [Parameter.FILTERS, URLParameter.FILTERS])) {
                // todo: parse parameter & url-parameter
                filters = await this.parseFilters(
                    input[Parameter.FILTERS] || input[URLParameter.FILTERS],
                    parameterOptions,
                );
            } else if (schema.filters.hasDefaults()) {
                // todo: maybe move to parser
                filters = await this.parseFilters(
                    undefined,
                    parameterOptions,
                );
            }

            if (typeof filters !== 'undefined') {
                output[Parameter.FILTERS] = filters;
            }
        }

        if (!this.skipParameter(options.pagination)) {
            let pagination : Pagination | undefined;

            if (this.hasParameterData(input, [Parameter.PAGINATION, URLParameter.PAGINATION])) {
                // todo: parse parameter & url-parameter
                pagination = await this.parsePagination(
                    input[Parameter.PAGINATION] || input[URLParameter.PAGINATION],
                );
            }

            if (typeof pagination !== 'undefined') {
                output[Parameter.PAGINATION] = pagination;
            }
        }

        if (!this.skipParameter(options.sort)) {
            let sort : Sorts | undefined;

            if (this.hasParameterData(input, [Parameter.SORT, URLParameter.SORT])) {
                // todo: parse parameter & url-parameter
                sort = await this.parseSort(
                    input[Parameter.SORT] || input[URLParameter.SORT],
                    parameterOptions,
                );
            } else if (schema.sort.defaultKeys.length > 0) {
                // todo: this should be simplified
                sort = await this.parseSort(undefined, parameterOptions);
            }

            if (typeof sort !== 'undefined') {
                output[Parameter.SORT] = sort;
            }
        }

        return output;
    }

    // -----------------------------------------------------

    /**
     * Parse relations input parameter.
     *
     * @param input
     * @param options
     */
    async parseRelations<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ): Promise<Relations> {
        return this.relationsParser.parse(input, options);
    }

    /**
     * Parse fields input parameter.
     *
     * @param input
     * @param options
     */
    async parseFields<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<Fields> {
        return this.fieldsParser.parse(input, options);
    }

    /**
     * Parse filter(s) input parameter.
     *
     * @param input
     * @param options
     */
    async parseFilters<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<Filters> {
        return this.filtersParser.parse(input, options);
    }

    /**
     * Parse pagination input parameter.
     *
     * @param input
     * @param options
     */
    async parsePagination<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<Pagination> {
        return this.paginationParser.parse(input, options);
    }

    /**
     * Parse sort input parameter.
     *
     * @param input
     * @param options
     */
    async parseSort<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<Sorts> {
        return this.sortParser.parse(input, options);
    }

    // --------------------------------------------------

    protected skipParameter(input?: boolean) : boolean {
        return typeof input === 'boolean' && !input;
    }

    protected hasParameterData(
        input: Record<string, any>,
        keys: string[],
    ): boolean {
        for (let i = 0; i < keys.length; i++) {
            if (isPropertySet(input, keys[i])) {
                return true;
            }
        }

        return false;
    }

    protected hasParameterOptionDefault(input: Record<string, any>) : boolean {
        return typeof input.default !== 'undefined';
    }
}
