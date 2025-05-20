/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter, URLParameter } from '../../constants';
import type {
    FieldsParseOutput,
    FiltersParseOutput,
    PaginationParseOutput,
    RelationsParseOutput,
    SortParseOutput,
} from '../../parameter';
import {
    BaseParser,
    FieldsParser,
    FiltersParser,
    PaginationParser,
    RelationsParser,
    SortParser,
} from '../../parser';
import { isObject, isPropertySet } from '../../utils';
import type {
    QueryParseInput, QueryParseOptions, QueryParseOutput, QueryParseParameterOptions,
} from './types';
import type { SchemaRegistry } from '../../schema';

export class QueryParser extends BaseParser<
QueryParseOptions,
QueryParseOutput
> {
    protected fieldsParser : FieldsParser;

    protected filtersParser : FiltersParser;

    protected paginationParser : PaginationParser;

    protected relationsParser : RelationsParser;

    protected sortParser : SortParser;

    // -----------------------------------------------------

    constructor(input?: SchemaRegistry) {
        super(input);

        this.fieldsParser = new FieldsParser(this.registry);
        this.filtersParser = new FiltersParser(this.registry);
        this.paginationParser = new PaginationParser(this.registry);
        this.relationsParser = new RelationsParser(this.registry);
        this.sortParser = new SortParser(this.registry);
    }

    // -----------------------------------------------------

    parse(
        input: unknown,
        options: QueryParseOptions = {},
    ): QueryParseOutput {
        const schema = this.resolveSchema(options.schema);

        const output : QueryParseOutput = {};
        if (schema.defaultPath) {
            output.defaultPath = schema.defaultPath;
        }

        if (!isObject(input)) {
            return output;
        }

        const parameterOptions : QueryParseParameterOptions = {
            schema,
        };

        if (!this.skipParameter(options.relations)) {
            let relations: RelationsParseOutput | undefined;

            if (this.hasParameterData(input, [Parameter.RELATIONS, URLParameter.RELATIONS])) {
                // todo: parse parameter & url-parameter
                relations = this.parseRelations(
                    input[Parameter.RELATIONS] || input[URLParameter.RELATIONS],
                );
            } else if (this.hasParameterOptionDefault(schema.relations)) {
                // todo: this should be simplified
                relations = this.parseRelations(undefined, parameterOptions);
            }

            if (typeof relations !== 'undefined') {
                output[Parameter.RELATIONS] = relations;
                parameterOptions.relations = relations;
            }
        }

        if (!this.skipParameter(options.fields)) {
            let fields : FieldsParseOutput | undefined;

            if (this.hasParameterData(input, [Parameter.FIELDS, URLParameter.FIELDS])) {
                // todo: parse parameter & url-parameter
                fields = this.parseFields(
                    input[Parameter.FIELDS] || input[URLParameter.FIELDS],
                    parameterOptions,
                );
            } else if (this.hasParameterOptionDefault(schema.fields)) {
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
            let filters : FiltersParseOutput | undefined;
            if (this.hasParameterData(input, [Parameter.FILTERS, URLParameter.FILTERS])) {
                // todo: parse parameter & url-parameter
                output[Parameter.FILTERS] = this.parseFilters(
                    input[Parameter.FILTERS] || input[URLParameter.FILTERS],
                    parameterOptions,
                );
            } else if (this.hasParameterOptionDefault(schema.filters)) {
                // todo: this should be simplified
                filters = this.parseFilters(undefined, parameterOptions);
            }

            if (typeof filters !== 'undefined') {
                output[Parameter.FILTERS] = filters;
            }
        }

        if (!this.skipParameter(options.pagination)) {
            let pagination : PaginationParseOutput | undefined;

            if (this.hasParameterData(input, [Parameter.PAGINATION, URLParameter.PAGINATION])) {
                // todo: parse parameter & url-parameter
                pagination = this.parsePagination(
                    input[Parameter.PAGINATION] || input[URLParameter.PAGINATION],
                );
            }

            if (typeof pagination !== 'undefined') {
                output[Parameter.PAGINATION] = pagination;
            }
        }

        if (!this.skipParameter(options.sort)) {
            let sort : SortParseOutput | undefined;

            if (this.hasParameterData(input, [Parameter.SORT, URLParameter.SORT])) {
                // todo: parse parameter & url-parameter
                sort = this.parseSort(
                    input[Parameter.SORT] || input[URLParameter.SORT],
                    parameterOptions,
                );
            } else if (this.hasParameterOptionDefault(schema.sort)) {
                // todo: this should be simplified
                sort = this.parseSort(undefined, parameterOptions);
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
    parseRelations(
        input: unknown,
        options: QueryParseParameterOptions = {},
    ): RelationsParseOutput {
        return this.relationsParser.parse(input, options);
    }

    /**
     * Parse fields input parameter.
     *
     * @param input
     * @param options
     */
    parseFields(
        input: unknown,
        options: QueryParseParameterOptions = {},
    ) : FieldsParseOutput {
        return this.fieldsParser.parse(input, options);
    }

    /**
     * Parse filter(s) input parameter.
     *
     * @param input
     * @param options
     */
    parseFilters(
        input: unknown,
        options: QueryParseParameterOptions = {},
    ) : FiltersParseOutput {
        return this.filtersParser.parse(input, options);
    }

    /**
     * Parse pagination input parameter.
     *
     * @param input
     * @param options
     */
    parsePagination(
        input: unknown,
        options: QueryParseParameterOptions = {},
    ) : PaginationParseOutput {
        return this.paginationParser.parse(input, options);
    }

    /**
     * Parse sort input parameter.
     *
     * @param input
     * @param options
     */
    parseSort(
        input: unknown,
        options: QueryParseParameterOptions = {},
    ) : SortParseOutput {
        return this.sortParser.parse(input, options);
    }

    // --------------------------------------------------

    protected skipParameter(input?: boolean) : boolean {
        return typeof input === 'boolean' && !input;
    }

    protected hasParameterData(
        input: QueryParseInput,
        keys: (keyof QueryParseInput)[],
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
