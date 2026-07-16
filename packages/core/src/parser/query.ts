/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../constants';
import type {
    IFields,
    IFilters,
    IPagination,
    IRelations,
    ISorts,
    QueryContext,
} from '../parameter';
import { Query } from '../parameter';
import type { ObjectLiteral } from '../types';
import { isObject, isPropertySet } from '../utils';
import { BaseParser } from './base';
import type { IQueryParameterParser, ParseParameterOptions, ParseQueryOptions } from './types';

/**
 * Shared query parse orchestration. Dialect packages supply the
 * per-parameter sub-parsers; this base owns the composition:
 * parameter key lookup, relation gating and the delegation order
 * (relations first, since they gate the rest).
 */
export abstract class BaseQueryParser extends BaseParser<ParseQueryOptions, Query> {
    protected abstract fieldsParser : IQueryParameterParser<IFields>;

    protected abstract filtersParser : IQueryParameterParser<IFilters>;

    protected abstract paginationParser : IQueryParameterParser<IPagination>;

    protected abstract relationsParser : IQueryParameterParser<IRelations>;

    protected abstract sortParser : IQueryParameterParser<ISorts>;

    // -----------------------------------------------------

    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseQueryOptions<RECORD> = {},
    ): Query {
        const output : QueryContext = {};
        const { data, parameterOptions } = this.prepareQueryContext(input, options);

        if (!this.skipParameter(options.relations)) {
            const relationsInput = this.readParameter(data, Parameter.RELATIONS);

            const relations = this.parseRelations(relationsInput, parameterOptions);
            output.relations = relations;
            this.gateRelations(parameterOptions, relationsInput, relations);
        }

        if (!this.skipParameter(options.fields)) {
            output.fields = this.parseFields(
                this.readParameter(data, Parameter.FIELDS),
                parameterOptions,
            );
        }

        if (!this.skipParameter(options.filters)) {
            output.filters = this.parseFilters(
                this.readParameter(data, Parameter.FILTERS),
                parameterOptions,
            );
        }

        if (!this.skipParameter(options.pagination)) {
            output.pagination = this.parsePagination(
                this.readParameter(data, Parameter.PAGINATION),
                parameterOptions,
            );
        }

        if (!this.skipParameter(options.sort)) {
            output.sorts = this.parseSort(
                this.readParameter(data, Parameter.SORT),
                parameterOptions,
            );
        }

        return new Query(output);
    }

    override async parseAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseQueryOptions<RECORD> = {},
    ) : Promise<Query> {
        const output : QueryContext = {};
        const { data, parameterOptions } = this.prepareQueryContext(input, options);

        if (!this.skipParameter(options.relations)) {
            const relationsInput = this.readParameter(data, Parameter.RELATIONS);

            const relations = await this.parseRelationsAsync(relationsInput, parameterOptions);
            output.relations = relations;
            this.gateRelations(parameterOptions, relationsInput, relations);
        }

        if (!this.skipParameter(options.fields)) {
            output.fields = await this.parseFieldsAsync(
                this.readParameter(data, Parameter.FIELDS),
                parameterOptions,
            );
        }

        if (!this.skipParameter(options.filters)) {
            output.filters = await this.parseFiltersAsync(
                this.readParameter(data, Parameter.FILTERS),
                parameterOptions,
            );
        }

        if (!this.skipParameter(options.pagination)) {
            output.pagination = await this.parsePaginationAsync(
                this.readParameter(data, Parameter.PAGINATION),
                parameterOptions,
            );
        }

        if (!this.skipParameter(options.sort)) {
            output.sorts = await this.parseSortAsync(
                this.readParameter(data, Parameter.SORT),
                parameterOptions,
            );
        }

        return new Query(output);
    }

    // -----------------------------------------------------

    /**
     * The option plumbing shared by {@link parse} and {@link parseAsync}.
     * Forwards the ORIGINAL schema input — a manufactured empty schema
     * would wrongly bind the parameter scopes.
     */
    protected prepareQueryContext<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseQueryOptions<RECORD>,
    ) : { data: ObjectLiteral, parameterOptions: ParseParameterOptions<RECORD> } {
        const data : ObjectLiteral = isObject(input) ? input : {};

        const parameterOptions : ParseParameterOptions<RECORD> = {};
        if (options.schema) {
            parameterOptions.schema = options.schema;
        }

        if (typeof options.strict !== 'undefined') {
            parameterOptions.strict = options.strict;
        }

        return { data, parameterOptions };
    }

    /**
     * Relation paths of the other parameters are only gated by the
     * relations parameter when the client actually supplied one.
     */
    protected gateRelations<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        parameterOptions: ParseParameterOptions<RECORD>,
        relationsInput: unknown,
        relations: IRelations,
    ) : void {
        if (typeof relationsInput !== 'undefined') {
            parameterOptions.relations = relations;
        }
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

    parseRelationsAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<IRelations> {
        return this.relationsParser.parseAsync(input, options);
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

    parseFieldsAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<IFields> {
        return this.fieldsParser.parseAsync(input, options);
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

    parseFiltersAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<IFilters> {
        return this.filtersParser.parseAsync(input, options);
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

    parsePaginationAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<IPagination> {
        return this.paginationParser.parseAsync(input, options);
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

    parseSortAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<ISorts> {
        return this.sortParser.parseAsync(input, options);
    }

    // --------------------------------------------------

    /**
     * Read a parameter from the input object by its
     * canonical {@link Parameter} key.
     */
    protected readParameter(
        input: ObjectLiteral,
        key: `${Parameter}`,
    ) : unknown {
        if (isPropertySet(input, key)) {
            return input[key];
        }

        return undefined;
    }

    protected skipParameter(input?: boolean) : boolean {
        return typeof input === 'boolean' && !input;
    }
}
