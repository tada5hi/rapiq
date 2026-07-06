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
    Query,
} from '../parameter';
import { QueryBuilder } from '../parameter';
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
        const output = new QueryBuilder();

        const data : ObjectLiteral = isObject(input) ? input : {};

        // forward the original schema input — a manufactured empty schema
        // would wrongly bind the parameter scopes.
        const parameterOptions : ParseParameterOptions<RECORD> = {};
        if (options.schema) {
            parameterOptions.schema = options.schema;
        }

        if (!this.skipParameter(options.relations)) {
            const relationsInput = this.readParameter(data, Parameter.RELATIONS);

            const relations = this.parseRelations(relationsInput, parameterOptions);
            output.relations = relations;

            // relation paths of the other parameters are only gated by the
            // relations parameter when the client actually supplied one.
            if (typeof relationsInput !== 'undefined') {
                parameterOptions.relations = relations;
            }
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
