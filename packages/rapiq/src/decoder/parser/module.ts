/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { Parameter, URLParameter } from '../../constants';
import type {
    Fields, Filters, Pagination, Query, Relations,
    Sorts,
} from '../../parameter';
import { BaseParser } from './base';
import {
    DecoderFieldsParser,
    DecoderFiltersParser,
    DecoderPaginationParser,
    DecoderRelationsParser,
    DecoderSortParser,
} from './parameters';
import type { ObjectLiteral } from '../../types';
import { isObject, isPropertySet } from '../../utils';
import type {
    ParseOptions, QueryParseParameterOptions,
} from './types';
import type { SchemaRegistry } from '../../schema';

export class DecoderParser extends BaseParser<
ParseOptions,
Query
> {
    protected fieldsParser : DecoderFieldsParser;

    protected filtersParser : DecoderFiltersParser;

    protected paginationParser : DecoderPaginationParser;

    protected relationsParser : DecoderRelationsParser;

    protected sortParser : DecoderSortParser;

    // -----------------------------------------------------

    constructor(input?: SchemaRegistry) {
        super(input);

        this.fieldsParser = new DecoderFieldsParser(this.registry);
        this.filtersParser = new DecoderFiltersParser(this.registry);
        this.paginationParser = new DecoderPaginationParser(this.registry);
        this.relationsParser = new DecoderRelationsParser(this.registry);
        this.sortParser = new DecoderSortParser(this.registry);
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

        const parameterOptions : QueryParseParameterOptions<RECORD> = {
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
        options: QueryParseParameterOptions<RECORD> = {},
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
        options: QueryParseParameterOptions<RECORD> = {},
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
        options: QueryParseParameterOptions<RECORD> = {},
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
        options: QueryParseParameterOptions<RECORD> = {},
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
        options: QueryParseParameterOptions<RECORD> = {},
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
