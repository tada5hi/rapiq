/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type {
    Fields,
    Filter,
    Filters,
    ObjectLiteral,
    Pagination,
    ParseParameterOptions,
    Relations,
    SchemaRegistry,
    Sorts,
} from 'rapiq';
import {
    BaseParser,
    Parameter,
    Query, isObject,
    isPropertySet,
} from 'rapiq';
import {
    ExpressionFieldsParser,
    ExpressionFiltersParser,
    ExpressionPaginationParser,
    ExpressionRelationsParser,
    ExpressionSortParser,
} from './parameter';

import type { ParseOptions } from './types';

export class ExpressionParser extends BaseParser<
ParseOptions,
Query
> {
    protected fieldsParser : ExpressionFieldsParser;

    protected filtersParser : ExpressionFiltersParser;

    protected paginationParser : ExpressionPaginationParser;

    protected relationsParser : ExpressionRelationsParser;

    protected sortParser : ExpressionSortParser;

    // -----------------------------------------------------

    constructor(input?: SchemaRegistry) {
        super(input);

        this.fieldsParser = new ExpressionFieldsParser(this.registry);
        this.filtersParser = new ExpressionFiltersParser(this.registry);
        this.paginationParser = new ExpressionPaginationParser(this.registry);
        this.relationsParser = new ExpressionRelationsParser(this.registry);
        this.sortParser = new ExpressionSortParser(this.registry);
    }

    // -----------------------------------------------------

    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseOptions<RECORD> = {},
    ): Query {
        const schema = this.getBaseSchema<RECORD>(options.schema);

        const output : Query = new Query();

        if (!isObject(input)) {
            return output;
        }

        const parameterOptions : ParseParameterOptions<RECORD> = {
            schema,
        };

        if (!this.skipParameter(options.relations)) {
            let relations: Relations | undefined;

            if (isPropertySet(input, Parameter.RELATIONS)) {
                // todo: parse parameter & url-parameter
                relations = this.parseRelations(
                    input[Parameter.RELATIONS],
                );
            }

            if (typeof relations !== 'undefined') {
                output[Parameter.RELATIONS] = relations;
                parameterOptions.relations = relations;
            }
        }

        if (!this.skipParameter(options.fields)) {
            let fields : Fields | undefined;

            if (isPropertySet(input, Parameter.FIELDS)) {
                // todo: parse parameter & url-parameter
                fields = this.parseFields(
                    input[Parameter.FIELDS],
                    parameterOptions,
                );
            } else if (schema.fields.hasDefaults()) {
                // todo: this should be simplified
                fields = this.parseFields(
                    undefined,
                    parameterOptions,
                );
            }

            if (typeof fields !== 'undefined') {
                output[Parameter.FIELDS] = fields;
            }
        }

        if (!this.skipParameter(options.filters)) {
            let filters : Filters | Filter | undefined;
            if (isPropertySet(input, Parameter.FILTERS)) {
                // todo: parse parameter & url-parameter
                filters = this.parseFilters(
                    input[Parameter.FILTERS],
                    parameterOptions,
                );
            } else if (schema.filters.hasDefaults()) {
                // todo: maybe move to parser
                filters = this.parseFilters(
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

            if (isPropertySet(input, Parameter.PAGINATION)) {
                // todo: parse parameter & url-parameter
                pagination = this.parsePagination(
                    input[Parameter.PAGINATION],
                );
            }

            if (typeof pagination !== 'undefined') {
                output[Parameter.PAGINATION] = pagination;
            }
        }

        if (!this.skipParameter(options.sort)) {
            let sort : Sorts | undefined;

            if (isPropertySet(input, Parameter.SORT)) {
                // todo: parse parameter & url-parameter
                sort = this.parseSort(
                    input[Parameter.SORT],
                    parameterOptions,
                );
            } else if (schema.sort.defaultKeys.length > 0) {
                // todo: this should be simplified
                sort = this.parseSort(undefined, parameterOptions);
            }

            if (typeof sort !== 'undefined') {
                output.sorts = sort;
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
    parseRelations<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ): Relations {
        return this.relationsParser.parse(input, options);
    }

    /**
     * Parse fields input parameter.
     *
     * @param input
     * @param options
     */
    parseFields<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Fields {
        return this.fieldsParser.parse(input, options);
    }

    /**
     * Parse filter(s) input parameter.
     *
     * @param input
     * @param options
     */
    parseFilters<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Filters | Filter {
        return this.filtersParser.parse(input, options);
    }

    /**
     * Parse pagination input parameter.
     *
     * @param input
     * @param options
     */
    parsePagination<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Pagination {
        return this.paginationParser.parse(input, options);
    }

    /**
     * Parse sort input parameter.
     *
     * @param input
     * @param options
     */
    parseSort<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Sorts {
        return this.sortParser.parse(input, options);
    }

    // --------------------------------------------------

    protected skipParameter(input?: boolean) : boolean {
        return typeof input === 'boolean' && !input;
    }
}
