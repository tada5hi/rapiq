/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../constants';
import { ParseError, isParseError } from '../errors';
import type {
    IFields,
    IFilters,
    IPagination,
    IRelations,
    ISorts,
    QueryContext,
} from '../parameter';
import {
    Fields,
    Filters,
    Pagination,
    Query,
    Relations,
    Sorts,
} from '../parameter';
import { FilterCompoundOperator } from '../schema';
import type { Schema } from '../schema';
import type { ObjectLiteral } from '../types';
import {
    isObject,
    isPropertySet,
    normalizeParameter,
    resolveAliasedKey,
} from '../utils';
import { BaseParser } from './base';
import { applyFiltersIndexPolicy, applySortsIndexPolicy } from './index-policy';
import type { IIssueCollector } from './issue';
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
    ParseTrace,
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
        const {
            data, 
            parameterOptions, 
            trace, 
        } = this.prepareQueryContext(input, options);
        const issueCollector = trace.collector;

        // pooled relation-authorization obligations across every parameter, so
        // the relations validate hook runs once per distinct relation and prunes
        // the whole query (see plan 022 / #815). The ledger is an explicit driver
        // argument, never part of the public parse options.
        const ledger : RelationLedger = [];

        if (!this.skipParameter(options, Parameter.RELATIONS)) {
            const relationsInput = this.readParameter(data, Parameter.RELATIONS);

            const relations = this.parseOne(issueCollector, Parameter.RELATIONS, new Relations(), () => this.relationsParser
                .parseParameter(relationsInput, parameterOptions, ledger, issueCollector));
            output.relations = relations;
            this.gateRelations(parameterOptions, relationsInput, relations);
        }

        if (!this.skipParameter(options, Parameter.FIELDS)) {
            output.fields = this.parseOne(issueCollector, Parameter.FIELDS, new Fields(), () => this.fieldsParser.parseParameter(
                this.readParameter(data, Parameter.FIELDS),
                parameterOptions,
                ledger,
                issueCollector,
            ));
        }

        if (!this.skipParameter(options, Parameter.FILTERS)) {
            const empty = new Filters(FilterCompoundOperator.AND, []);
            output.filters = this.parseOne(issueCollector, Parameter.FILTERS, empty, () => this.filtersParser
                .parseParameter(
                    this.readParameter(data, Parameter.FILTERS),
                    parameterOptions,
                    ledger,
                    issueCollector,
                ));
        }

        if (!this.skipParameter(options, Parameter.PAGINATION)) {
            output.pagination = this.parseOne(issueCollector, Parameter.PAGINATION, new Pagination(), () => this.paginationParser
                .parseParameter(
                    this.readParameter(data, Parameter.PAGINATION),
                    parameterOptions,
                    ledger,
                    issueCollector,
                ));
        }

        if (!this.skipParameter(options, Parameter.SORTS)) {
            output.sorts = this.parseOne(issueCollector, Parameter.SORTS, new Sorts(), () => this.sortParser.parseParameter(
                this.readParameter(data, Parameter.SORTS),
                parameterOptions,
                ledger,
                issueCollector,
            ));
        }

        // the cross-parameter passes belong to the trace like the parameters
        // do: a rejection they throw (rather than record) must not leave with
        // an empty trace.
        this.recordFailure(trace, () => {
            const rejected = this.applyRelationValidations(ledger, options, issueCollector);
            this.pruneByRelations(output, rejected, options, issueCollector);
            this.applyIndexPolicies(output, options, issueCollector);
        });

        this.finishIssues(trace);

        return new Query(output);
    }

    override async parseAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseQueryOptions<RECORD> = {},
    ) : Promise<Query> {
        const output : QueryContext = {};
        const {
            data, 
            parameterOptions, 
            trace, 
        } = this.prepareQueryContext(input, options);
        const issueCollector = trace.collector;

        const ledger : RelationLedger = [];

        if (!this.skipParameter(options, Parameter.RELATIONS)) {
            const relationsInput = this.readParameter(data, Parameter.RELATIONS);

            const relations = await this.parseOneAsync(issueCollector, Parameter.RELATIONS, new Relations(), () => this
                .relationsParser.parseParameterAsync(relationsInput, parameterOptions, ledger, issueCollector));
            output.relations = relations;
            this.gateRelations(parameterOptions, relationsInput, relations);
        }

        if (!this.skipParameter(options, Parameter.FIELDS)) {
            output.fields = await this.parseOneAsync(issueCollector, Parameter.FIELDS, new Fields(), () => this.fieldsParser
                .parseParameterAsync(
                    this.readParameter(data, Parameter.FIELDS),
                    parameterOptions,
                    ledger,
                    issueCollector,
                ));
        }

        if (!this.skipParameter(options, Parameter.FILTERS)) {
            const empty = new Filters(FilterCompoundOperator.AND, []);
            output.filters = await this.parseOneAsync(issueCollector, Parameter.FILTERS, empty, () => this.filtersParser
                .parseParameterAsync(
                    this.readParameter(data, Parameter.FILTERS),
                    parameterOptions,
                    ledger,
                    issueCollector,
                ));
        }

        if (!this.skipParameter(options, Parameter.PAGINATION)) {
            output.pagination = await this.parseOneAsync(
                issueCollector,
                Parameter.PAGINATION,
                new Pagination(),
                () => this.paginationParser.parseParameterAsync(
                    this.readParameter(data, Parameter.PAGINATION),
                    parameterOptions,
                    ledger,
                    issueCollector,
                ),
            );
        }

        if (!this.skipParameter(options, Parameter.SORTS)) {
            output.sorts = await this.parseOneAsync(issueCollector, Parameter.SORTS, new Sorts(), () => this.sortParser
                .parseParameterAsync(
                    this.readParameter(data, Parameter.SORTS),
                    parameterOptions,
                    ledger,
                    issueCollector,
                ));
        }

        await this.recordFailureAsync(trace, async () => {
            const rejected = await this.applyRelationValidationsAsync(ledger, options, issueCollector);
            this.pruneByRelations(output, rejected, options, issueCollector);
            this.applyIndexPolicies(output, options, issueCollector);
        });

        this.finishIssues(trace);

        return new Query(output);
    }

    // -----------------------------------------------------

    /**
     * Run one parameter, keeping a structural failure inside it.
     *
     * A malformed expression or an input of the wrong shape aborts the
     * parameter it was found in (there is no next key to move on to), but the
     * other four parameters are independent and still parse. The failure is
     * recorded as an error issue, so the query parse ends on it (or on an
     * earlier one) exactly as it would have ended on the immediate throw.
     */
    protected parseOne<T>(
        issueCollector: IIssueCollector,
        parameter: `${Parameter}`,
        fallback: T,
        fn: () => T,
    ) : T {
        try {
            return fn();
        } catch (e) {
            if (isParseError(e)) {
                issueCollector.addError(e, parameter);

                return fallback;
            }

            throw e;
        }
    }

    protected async parseOneAsync<T>(
        issueCollector: IIssueCollector,
        parameter: `${Parameter}`,
        fallback: T,
        fn: () => Promise<T>,
    ) : Promise<T> {
        try {
            return await fn();
        } catch (e) {
            if (isParseError(e)) {
                issueCollector.addError(e, parameter);

                return fallback;
            }

            throw e;
        }
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
    ) : {
        data: ObjectLiteral,
        parameterOptions: ParseParameterOptions<RECORD>,
        trace: ParseTrace,
    } {
        const data : ObjectLiteral = isObject(input) ? input : {};

        // one trace for the whole query: the sub-parsers record into it and
        // defer throwing, so a violation in the first parameter no longer
        // hides what the other four would have reported. This call owns it,
        // and raises it once every parameter has been seen.
        const trace = this.beginIssues();

        // the trace reaches the sub-parsers as a driver argument, never as an
        // option: a consumer able to supply one would take over the decision
        // to raise, and a rejection nobody raises is a rejection that became
        // a silent drop.
        const parameterOptions : ParseParameterOptions<RECORD> = {};
        if (options.schema) {
            parameterOptions.schema = options.schema;
        }

        if (typeof options.strict !== 'undefined') {
            parameterOptions.strict = options.strict;
        }

        if (typeof options.throwOnFailure !== 'undefined') {
            parameterOptions.throwOnFailure = options.throwOnFailure;
        }

        if (typeof options.context !== 'undefined') {
            parameterOptions.context = options.context;
        }

        return {
            data, 
            parameterOptions, 
            trace, 
        };
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
        issueCollector?: IIssueCollector,
    ) : string[] {
        if (ledger.length === 0 || !options.schema) {
            return [];
        }

        const schema = this.registry.getOrFail(options.schema);

        return applyKeySchemaValidation(ledger, options.context, {
            throwOnFailure: options.throwOnFailure ?? schema.relations.throwOnFailure ?? false,
            errors: RelationsParseError,
            issueCollector,
        });
    }

    protected async applyRelationValidationsAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        ledger: RelationLedger,
        options: ParseQueryOptions<RECORD>,
        issueCollector?: IIssueCollector,
    ) : Promise<string[]> {
        if (ledger.length === 0 || !options.schema) {
            return [];
        }

        const schema = this.registry.getOrFail(options.schema);

        return applyKeySchemaValidationAsync(ledger, options.context, {
            throwOnFailure: options.throwOnFailure ?? schema.relations.throwOnFailure ?? false,
            errors: RelationsParseError,
            issueCollector,
        });
    }

    /**
     * Drop every field/filter/sort/relation traversing a rejected relation from
     * the assembled query. Filters and sorts fall back to their schema defaults
     * when pruning empties them, matching the parser's own default fallback.
     */
    protected pruneByRelations<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        output: QueryContext,
        rejected: string[],
        options: ParseQueryOptions<RECORD>,
        issueCollector?: IIssueCollector,
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
            output.filters = pruneFiltersByRelations(output.filters, rejected, schema?.filters, issueCollector);
        }
    }

    /**
     * Enforce the schema's `indexed` policies on the final composed
     * query, after relation pruning: the check governs the tree that
     * will actually execute. Per-parameter throw policy comes from the
     * sub-schemas themselves.
     */
    protected applyIndexPolicies<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        output: QueryContext,
        options: ParseQueryOptions<RECORD>,
        issueCollector?: IIssueCollector,
    ) : void {
        const context = { throwOnFailure: options.throwOnFailure, issueCollector };

        if (output.filters) {
            output.filters = applyFiltersIndexPolicy(output.filters, this.registry, options.schema, context);
        }

        if (output.sorts) {
            output.sorts = applySortsIndexPolicy(output.sorts, this.registry, options.schema, context);
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
     * Parse sorts input parameter.
     *
     * @param input
     * @param options
     */
    parseSorts<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : ISorts {
        return this.sortParser.parse(input, options);
    }

    parseSortsAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<ISorts> {
        return this.sortParser.parseAsync(input, options);
    }

    /**
     * @deprecated use {@link BaseQueryParser.parseSorts}. Removed in 3.0.
     */
    parseSort<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : ISorts {
        return this.parseSorts(input, options);
    }

    /**
     * @deprecated use {@link BaseQueryParser.parseSortsAsync}. Removed in 3.0.
     */
    parseSortAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: ParseParameterOptions<RECORD> = {},
    ) : Promise<ISorts> {
        return this.parseSortsAsync(input, options);
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
        if (key === Parameter.SORTS) {
            return resolveAliasedKey(
                input,
                Parameter.SORTS,
                Parameter.SORT,
                (canonical, alias) => ParseError.keyAmbiguous(canonical, alias),
            );
        }

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
            !options.parameters
                .map((item) => normalizeParameter(item))
                .includes(normalizeParameter(parameter))
        ) {
            return true;
        }

        const flag = parameter === Parameter.SORTS ?
            resolveAliasedKey(
                options,
                Parameter.SORTS,
                Parameter.SORT,
                (canonical, alias) => ParseError.keyAmbiguous(canonical, alias),
            ) :
            options[parameter];

        return typeof flag === 'boolean' && !flag;
    }
}
