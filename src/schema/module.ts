/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter, URLParameter } from '../constants';
import type {
    FieldsParseOutput,
    FiltersParseOutput,
    PaginationParseOutput,
    ParseBaseOptions,

    RelationsParseOutput,
    SortParseOutput,
} from '../parameter';
import {
    FieldsOptionsContainer,
    FiltersOptionsContainer,
    SortOptionsContainer,
    parseQueryFields,
    parseQueryFilters,
    parseQueryPagination,
    parseQueryRelations,
    parseQuerySort,
} from '../parameter';
import type { ParseInput, ParseOutput } from '../parse';
import { isQueryParameterEnabled } from '../parse';
import type { ObjectLiteral } from '../types';
import type { SchemaOptions } from './types';

export class Schema<T extends ObjectLiteral = ObjectLiteral> {
    protected options: SchemaOptions<T>;

    protected fieldsOptionsContainer : FieldsOptionsContainer<T>;

    protected filtersOptionsContainer : FiltersOptionsContainer<T>;

    protected sortOptionsContainer: SortOptionsContainer<T>;

    // ---------------------------------------------------------

    constructor(options: SchemaOptions<T>) {
        this.options = options;

        this.fieldsOptionsContainer = new FieldsOptionsContainer(this.options.fields);
        this.filtersOptionsContainer = new FiltersOptionsContainer(this.options.filters);
        this.sortOptionsContainer = new SortOptionsContainer(this.options.sort);
    }

    // ---------------------------------------------------------

    parseQuery(
        input: ParseInput,
        options: ParseBaseOptions = {},
    ) {
        const output : ParseOutput = {};
        if (this.options.defaultPath) {
            output.defaultPath = this.options.defaultPath;
        }

        let value = input[Parameter.RELATIONS] || input[URLParameter.RELATIONS];
        if (isQueryParameterEnabled({ data: value, options: this.options[Parameter.RELATIONS] })) {
            const relations = this.parseQueryRelations(value);

            output[Parameter.RELATIONS] = relations;
            options.relations = relations;
        }

        value = input[Parameter.FIELDS] || input[URLParameter.FIELDS];
        if (isQueryParameterEnabled({ data: value, options: this.options[Parameter.FIELDS] })) {
            output[Parameter.FIELDS] = this.parseQueryFields(value, options);
        }

        value = input[Parameter.FILTERS] || input[URLParameter.FILTERS];
        if (isQueryParameterEnabled({ data: value, options: this.options[Parameter.FILTERS] })) {
            output[Parameter.FILTERS] = this.parseQueryFilters(value, options);
        }

        value = input[Parameter.PAGINATION] || input[URLParameter.PAGINATION];
        if (isQueryParameterEnabled({ data: value, options: this.options[Parameter.PAGINATION] })) {
            output[Parameter.PAGINATION] = this.parseQueryPagination(value);
        }

        value = input[Parameter.SORT] || input[URLParameter.SORT];
        if (isQueryParameterEnabled({ data: value, options: this.options[Parameter.SORT] })) {
            output[Parameter.SORT] = this.parseQuerySort(value, options);
        }

        return output;
    }

    /**
     * Parse relations input parameter.
     *
     * @param input
     * @param options
     */
    parseQueryRelations(
        input: unknown,
        options: ParseBaseOptions = {},
    ): RelationsParseOutput {
        return parseQueryRelations(
            input,
            {
                ...this.extendParameterOptions(this.options[Parameter.RELATIONS] || {}),
                ...options,
            },
        );
    }

    /**
     * Parse fields input parameter.
     *
     * @param input
     * @param options
     */
    parseQueryFields(
        input: unknown,
        options: ParseBaseOptions = {},
    ) : FieldsParseOutput {
        return parseQueryFields(
            input,
            {
                ...this.extendParameterOptions(this.options[Parameter.FIELDS] || {}),
                ...options,
            },
        );
    }

    /**
     * Parse filter(s) input parameter.
     *
     * @param input
     * @param options
     */
    parseQueryFilters(
        input: unknown,
        options: ParseBaseOptions = {},
    ) : FiltersParseOutput {
        return parseQueryFilters(
            input,
            {
                ...this.extendParameterOptions(this.options[Parameter.FILTERS] || {}),
                ...options,
            },
        );
    }

    /**
     * Parse pagination input parameter.
     *
     * @param input
     */
    parseQueryPagination(input: unknown) : PaginationParseOutput {
        return parseQueryPagination(
            input,
            this.extendParameterOptions(this.options[Parameter.PAGINATION] || {}),
        );
    }

    /**
     * Parse sort input parameter.
     *
     * @param input
     * @param options
     */
    parseQuerySort(
        input: unknown,
        options: ParseBaseOptions = {},
    ) : SortParseOutput {
        return parseQuerySort(
            input,
            {
                ...this.extendParameterOptions(this.options[Parameter.SORT] || {}),
                ...options,
            },
        );
    }

    // ---------------------------------------------------------

    buildQuery(query: unknown): string {
        // todo: implement method
        return `${query}`;
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
