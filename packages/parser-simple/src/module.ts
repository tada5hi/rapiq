/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type {
    IFields,
    IFilters,
    IPagination,
    IRelations,
    ISorts,
    ObjectLiteral,
    ParseParameterOptions,
    Query,
    SchemaRegistry,
} from '@rapiq/core';
import {
    BaseParser,
    Parameter,
    QueryBuilder,
    isObject,
    isPropertySet,
} from '@rapiq/core';
import {
    SimpleFieldsParser,
    SimpleFiltersParser,
    SimplePaginationParser,
    SimpleRelationsParser,
    SimpleSortParser,
} from './parameter';

import type { ParseOptions } from './types';

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

    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseOptions<RECORD> = {},
    ): Query {
        const schema = this.getBaseSchema<RECORD>(options.schema);

        const output = new QueryBuilder();

        if (!isObject(input)) {
            return output.build();
        }

        const parameterOptions : ParseParameterOptions<RECORD> = {
            schema,
        };

        if (!this.skipParameter(options.relations)) {
            let relations: IRelations | undefined;

            if (isPropertySet(input, Parameter.RELATIONS)) {
                // todo: parse parameter & url-parameter
                relations = this.parseRelations(
                    input[Parameter.RELATIONS],
                );
            }

            if (typeof relations !== 'undefined') {
                output.relations = relations;
                parameterOptions.relations = relations;
            }
        }

        if (!this.skipParameter(options.fields)) {
            let fields : IFields | undefined;

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
                output.fields = fields;
            }
        }

        if (!this.skipParameter(options.filters)) {
            let filters : IFilters | undefined;
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
                output.filters = filters;
            }
        }

        if (!this.skipParameter(options.pagination)) {
            let pagination : IPagination | undefined;

            if (isPropertySet(input, Parameter.PAGINATION)) {
                // todo: parse parameter & url-parameter
                pagination = this.parsePagination(
                    input[Parameter.PAGINATION],
                );
            }

            if (typeof pagination !== 'undefined') {
                output.pagination = pagination;
            }
        }

        if (!this.skipParameter(options.sort)) {
            let sorts : ISorts | undefined;

            if (isPropertySet(input, Parameter.SORT)) {
                // todo: parse parameter & url-parameter
                sorts = this.parseSort(
                    input[Parameter.SORT],
                    parameterOptions,
                );
            } else if (schema.sort.defaultKeys.length > 0) {
                // todo: this should be simplified
                sorts = this.parseSort(undefined, parameterOptions);
            }

            if (typeof sorts !== 'undefined') {
                output.sorts = sorts;
            }
        }

        return output.build();
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
    ): IRelations {
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
    ) : IFields {
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
    ) : IFilters {
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
    ) : IPagination {
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
    ) : ISorts {
        return this.sortParser.parse(input, options);
    }

    // --------------------------------------------------

    protected skipParameter(input?: boolean) : boolean {
        return typeof input === 'boolean' && !input;
    }
}
