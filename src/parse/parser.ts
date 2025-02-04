/*
 * Copyright (c) 2024-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter, URLParameter } from '../constants';
import type {
    FieldsParseOutput,
    FiltersParseOutput, PaginationParseOutput,
    RelationsParseOutput,
    SortParseOutput,
} from '../parameter';
import {
    parseQueryFields,
    parseQueryFilters,
    parseQueryPagination,
    parseQueryRelations,
    parseQuerySort,
} from '../parameter';
import type {
    ParseInput,
    ParseOutput,
    QueryParserOptions,
} from './type';
import type { ParseParametersOutput } from './parameter';
import {
    buildQueryParameterOptions,
    isQueryParameterEnabled,
} from './parameter';
import type { ObjectLiteral } from '../type';

export class QueryParser<T extends ObjectLiteral = ObjectLiteral> {
    protected options : QueryParserOptions<T>;

    constructor(options: QueryParserOptions<T> = {}) {
        // todo: do ahead of parse/stringify options computation
        this.options = options;
    }

    // --------------------------------------------------

    parse(input: ParseInput) : ParseParametersOutput {
        const output : ParseOutput = {};
        if (this.options.defaultPath) {
            output.defaultPath = this.options.defaultPath;
        }

        let relations : RelationsParseOutput | undefined;

        let value = input[Parameter.RELATIONS] || input[URLParameter.RELATIONS];
        if (isQueryParameterEnabled({ data: value, options: this.options[Parameter.RELATIONS] })) {
            relations = this.parseRelations(value);

            output[Parameter.RELATIONS] = relations;
        }

        value = input[Parameter.FIELDS] || input[URLParameter.FIELDS];
        if (isQueryParameterEnabled({ data: value, options: this.options[Parameter.FIELDS] })) {
            output[Parameter.FIELDS] = this.parseFields(value, relations);
        }

        value = input[Parameter.FILTERS] || input[URLParameter.FILTERS];
        if (isQueryParameterEnabled({ data: value, options: this.options[Parameter.FILTERS] })) {
            output[Parameter.FILTERS] = this.parseFilters(value, relations);
        }

        value = input[Parameter.PAGINATION] || input[URLParameter.PAGINATION];
        if (isQueryParameterEnabled({ data: value, options: this.options[Parameter.PAGINATION] })) {
            output[Parameter.PAGINATION] = this.parsePagination(value);
        }

        value = input[Parameter.SORT] || input[URLParameter.SORT];
        if (isQueryParameterEnabled({ data: value, options: this.options[Parameter.SORT] })) {
            output[Parameter.SORT] = this.parseSort(value, relations);
        }

        return output;
    }

    // --------------------------------------------------

    /**
     * Parse relations input parameter.
     *
     * @param input
     */
    parseRelations(input: unknown) : RelationsParseOutput {
        return parseQueryRelations(
            input,
            buildQueryParameterOptions(this.options[Parameter.RELATIONS]),
        );
    }

    /**
     * Parse fields input parameter.
     *
     * @param input
     * @param relations
     */
    parseFields(input: unknown, relations?: RelationsParseOutput) : FieldsParseOutput {
        return parseQueryFields(
            input,
            {
                ...this.extendParameterOptions(buildQueryParameterOptions(this.options[Parameter.FIELDS])),
                ...(relations ? { relations } : {}),
            },
        );
    }

    /**
     * Parse filter(s) input parameter.
     *
     * @param input
     * @param relations
     */
    parseFilters(input: unknown, relations?: RelationsParseOutput) : FiltersParseOutput {
        return parseQueryFilters(
            input,
            {
                ...this.extendParameterOptions(buildQueryParameterOptions(this.options[Parameter.FILTERS])),
                ...(relations ? { relations } : {}),
            },
        );
    }

    /**
     * Parse pagination input parameter.
     *
     * @param input
     */
    parsePagination(input: unknown) : PaginationParseOutput {
        return parseQueryPagination(
            input,
            this.extendParameterOptions(buildQueryParameterOptions(this.options[Parameter.PAGINATION])),
        );
    }

    /**
     * Parse sort input parameter.
     *
     * @param input
     * @param relations
     */
    parseSort(input: unknown, relations?: RelationsParseOutput) : SortParseOutput {
        return parseQuerySort(
            input,
            {
                ...this.extendParameterOptions(buildQueryParameterOptions(this.options[Parameter.SORT])),
                ...(relations ? { relations } : {}),
            },
        );
    }

    // --------------------------------------------------

    printOptions() {
        // todo: output formatted options!
    }

    // --------------------------------------------------

    protected extendParameterOptions<T extends {
        defaultPath?: string,
        throwOnFailure?: boolean
    }>(data: T) : T {
        if (typeof data.defaultPath === 'undefined') {
            data.defaultPath = this.options.defaultPath;
        }

        if (typeof data.throwOnFailure === 'undefined') {
            data.throwOnFailure = this.options.throwOnFailure;
        }

        return data;
    }
}
