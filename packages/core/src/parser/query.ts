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
import type { Schema } from '../schema';
import type { ObjectLiteral } from '../types';
import { isObject, isPropertySet } from '../utils';
import { BaseParser } from './base';
import { RelationsParseError } from './parameter/relations/error';
import {
    applyKeySchemaValidation,
    applyKeySchemaValidationAsync,
} from './parameter/validate';
import {
    pruneFieldsByRelations,
    pruneFiltersByRelations,
    pruneRelationsByRelations,
    pruneSortsByRelations,
} from './relation-prune';
import type {
    IQueryParameterParser,
    ParseParameterOptions,
    ParseQueryOptions,
    RelationLedger,
} from './types';

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

        // pooled relation-authorization obligations across every parameter, so
        // the relations validate hook runs once per distinct relation and prunes
        // the whole query (see plan 022 / #815). The ledger is an explicit driver
        // argument, never part of the public parse options.
        const ledger : RelationLedger = [];

        if (!this.skipParameter(options, Parameter.RELATIONS)) {
            const relationsInput = this.readParameter(data, Parameter.RELATIONS);

            const relations = this.relationsParser.parseParameter(relationsInput, parameterOptions, ledger);
            output.relations = relations;
            this.gateRelations(parameterOptions, relationsInput, relations);
        }

        if (!this.skipParameter(options, Parameter.FIELDS)) {
            output.fields = this.fieldsParser.parseParameter(
                this.readParameter(data, Parameter.FIELDS),
                parameterOptions,
                ledger,
            );
        }

        if (!this.skipParameter(options, Parameter.FILTERS)) {
            output.filters = this.filtersParser.parseParameter(
                this.readParameter(data, Parameter.FILTERS),
                parameterOptions,
                ledger,
            );
        }

        if (!this.skipParameter(options, Parameter.PAGINATION)) {
            output.pagination = this.paginationParser.parseParameter(
                this.readParameter(data, Parameter.PAGINATION),
                parameterOptions,
                ledger,
            );
        }

        if (!this.skipParameter(options, Parameter.SORT)) {
            output.sorts = this.sortParser.parseParameter(
                this.readParameter(data, Parameter.SORT),
                parameterOptions,
                ledger,
            );
        }

        const rejected = this.applyRelationValidations(ledger, options);
        this.pruneByRelations(output, rejected, options);

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

        const ledger : RelationLedger = [];

        if (!this.skipParameter(options, Parameter.RELATIONS)) {
            const relationsInput = this.readParameter(data, Parameter.RELATIONS);

            const relations = await this.relationsParser.parseParameterAsync(relationsInput, parameterOptions, ledger);
            output.relations = relations;
            this.gateRelations(parameterOptions, relationsInput, relations);
        }

        if (!this.skipParameter(options, Parameter.FIELDS)) {
            output.fields = await this.fieldsParser.parseParameterAsync(
                this.readParameter(data, Parameter.FIELDS),
                parameterOptions,
                ledger,
            );
        }

        if (!this.skipParameter(options, Parameter.FILTERS)) {
            output.filters = await this.filtersParser.parseParameterAsync(
                this.readParameter(data, Parameter.FILTERS),
                parameterOptions,
                ledger,
            );
        }

        if (!this.skipParameter(options, Parameter.PAGINATION)) {
            output.pagination = await this.paginationParser.parseParameterAsync(
                this.readParameter(data, Parameter.PAGINATION),
                parameterOptions,
                ledger,
            );
        }

        if (!this.skipParameter(options, Parameter.SORT)) {
            output.sorts = await this.sortParser.parseParameterAsync(
                this.readParameter(data, Parameter.SORT),
                parameterOptions,
                ledger,
            );
        }

        const rejected = await this.applyRelationValidationsAsync(ledger, options);
        this.pruneByRelations(output, rejected, options);

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

        if (typeof options.context !== 'undefined') {
            parameterOptions.context = options.context;
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

    /**
     * Evaluate the pooled relation-authorization obligations once — deduped
     * across every parameter — under the relations schema's failure policy.
     * Returns the canonical relation paths the hook rejected, for
     * {@link pruneByRelations}. A rejection under `throwOnFailure` throws
     * `RelationsParseError`, regardless of which parameter forced the join.
     */
    protected applyRelationValidations<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        ledger: RelationLedger,
        options: ParseQueryOptions<RECORD>,
    ) : string[] {
        if (ledger.length === 0 || !options.schema) {
            return [];
        }

        const schema = this.registry.getOrFail(options.schema);

        return applyKeySchemaValidation(ledger, options.context, {
            throwOnFailure: schema.relations.throwOnFailure ?? false,
            errors: RelationsParseError,
        });
    }

    protected async applyRelationValidationsAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        ledger: RelationLedger,
        options: ParseQueryOptions<RECORD>,
    ) : Promise<string[]> {
        if (ledger.length === 0 || !options.schema) {
            return [];
        }

        const schema = this.registry.getOrFail(options.schema);

        return applyKeySchemaValidationAsync(ledger, options.context, {
            throwOnFailure: schema.relations.throwOnFailure ?? false,
            errors: RelationsParseError,
        });
    }

    /**
     * Drop every field/filter/sort/relation traversing a rejected relation from
     * the assembled query. Filters and sort fall back to their schema defaults
     * when pruning empties them, matching the parser's own default fallback.
     */
    protected pruneByRelations<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        output: QueryContext,
        rejected: string[],
        options: ParseQueryOptions<RECORD>,
    ) : void {
        if (rejected.length === 0) {
            return;
        }

        const schema : Schema<RECORD> | undefined = options.schema ?
            this.registry.getOrFail(options.schema) :
            undefined;

        if (output.relations) {
            output.relations = pruneRelationsByRelations(output.relations, rejected);
        }

        if (output.fields) {
            output.fields = pruneFieldsByRelations(output.fields, rejected);
        }

        if (output.sorts) {
            output.sorts = pruneSortsByRelations(output.sorts, rejected, schema?.sort);
        }

        if (output.filters) {
            output.filters = pruneFiltersByRelations(output.filters, rejected, schema?.filters);
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

    /**
     * A parameter is skipped when the `parameters` allow-list
     * excludes it or its per-parameter option is `false`. A skipped
     * parameter is neither parsed nor defaulted — the query leaves
     * it empty, as if input and schema said nothing about it.
     */
    protected skipParameter<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        options: ParseQueryOptions<RECORD>,
        parameter: `${Parameter}`,
    ) : boolean {
        if (
            typeof options.parameters !== 'undefined' &&
            !options.parameters.includes(parameter)
        ) {
            return true;
        }

        const flag = options[parameter];

        return typeof flag === 'boolean' && !flag;
    }
}
