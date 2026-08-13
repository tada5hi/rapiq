/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BaseParser,
    DEFAULT_ID,
    ErrorCode,
    ErrorMessage,
    Filter,
    FilterCompoundOperator,
    Filters,
    Parameter,
    RelationsParseError,
    ResolutionScope,
    applyFiltersIndexPolicy,
    applyFiltersSchemaValidation,
    applyFiltersSchemaValidationAsync,
    applyKeySchemaValidation,
    applyKeySchemaValidationAsync,
    buildFiltersDefaults,
    isObject,
    parseKey,
    pruneFiltersByRelations,
    stringifyKey,
} from '@rapiq/core';

import type {
    FilterFieldOperator,
    FiltersParseOptions,
    FiltersSchema,
    ICondition,
    IFilter,
    IFilters,
    IssueCollector,
    ObjectLiteral,
    RelationLedger,

    TempType,
} from '@rapiq/core';

import type { SimpleFiltersParserInput } from './types';
import { decodeFilterWireValue } from './wire';

type FiltersScope<RECORD extends ObjectLiteral> = ResolutionScope<`${Parameter.FILTERS}`, RECORD>;

export class SimpleFiltersParser extends BaseParser<
    FiltersParseOptions,
    IFilters
> {
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters {
        const ledger : RelationLedger = [];
        const {
            output, 
            scope, 
            issues, 
        } = this.build(input, options, ledger);

        const result = applyFiltersIndexPolicy(
            pruneFiltersByRelations(output, applyKeySchemaValidation(ledger, options.context, {
                throwOnFailure: scope.relationsThrowOnFailure,
                errors: RelationsParseError,
                issues,
            }), scope.schema as FiltersSchema<RECORD>, issues),
            this.registry,
            options.schema,
            { throwOnFailure: options.throwOnFailure, issues },
        );

        this.finishIssues(undefined, issues);

        return result;
    }

    override async parseAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Promise<IFilters> {
        const ledger : RelationLedger = [];
        const {
            output, 
            scope, 
            issues, 
        } = await this.buildAsync(input, options, ledger);

        const result = applyFiltersIndexPolicy(
            pruneFiltersByRelations(output, await applyKeySchemaValidationAsync(ledger, options.context, {
                throwOnFailure: scope.relationsThrowOnFailure,
                errors: RelationsParseError,
                issues,
            }), scope.schema as FiltersSchema<RECORD>, issues),
            this.registry,
            options.schema,
            { throwOnFailure: options.throwOnFailure, issues },
        );

        this.finishIssues(undefined, issues);

        return result;
    }

    parseParameter<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD>,
        ledger: RelationLedger,
        issues?: IssueCollector,
    ) : IFilters {
        const trace = this.build(input, options, ledger, issues);

        // a no-op when the query orchestrator handed down its trace, and the
        // fail-fast raise when this parser was driven directly: a violation
        // must never degrade into a silent drop just because nobody raised
        // the trace it was recorded into.
        this.finishIssues(issues, trace.issues);

        return trace.output;
    }

    async parseParameterAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD>,
        ledger: RelationLedger,
        issues?: IssueCollector,
    ) : Promise<IFilters> {
        const trace = await this.buildAsync(input, options, ledger, issues);

        // a no-op when the query orchestrator handed down its trace, and the
        // fail-fast raise when this parser was driven directly: a violation
        // must never degrade into a silent drop just because nobody raised
        // the trace it was recorded into.
        this.finishIssues(issues, trace.issues);

        return trace.output;
    }

    protected build<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD>,
        ledger: RelationLedger,
        driver?: IssueCollector,
    ) : {
        output: IFilters, 
        scope: FiltersScope<RECORD>, 
        issues: IssueCollector 
    } {
        const issues = this.beginIssues(options, driver);
        const scope = this.scopeFor(options, ledger, issues);

        const parsed = this.run(input, scope);

        let items: ICondition[] = parsed;
        if (items.length > 0) {
            items = items
                .map((item) => applyFiltersSchemaValidation(item, scope.schema, options.context, {
                    issues,
                    throwOnFailure: options.throwOnFailure,
                }))
                .filter((item): item is ICondition => typeof item !== 'undefined');
        }

        if (items.length === 0) {
            items = this.defaults(scope, parsed.length > 0);
        }

        return {
            output: new Filters(FilterCompoundOperator.AND, items), 
            scope, 
            issues, 
        };
    }

    protected async buildAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD>,
        ledger: RelationLedger,
        driver?: IssueCollector,
    ) : Promise<{
        output: IFilters, 
        scope: FiltersScope<RECORD>, 
        issues: IssueCollector 
    }> {
        const issues = this.beginIssues(options, driver);
        const scope = this.scopeFor(options, ledger, issues);

        const parsed = this.run(input, scope);

        let items: ICondition[] = [];
        for (const item of parsed) {
            const validated = await applyFiltersSchemaValidationAsync(item, scope.schema, options.context, {
                issues,
                throwOnFailure: options.throwOnFailure,
            });
            if (validated) {
                items.push(validated);
            }
        }

        if (items.length === 0) {
            items = this.defaults(scope, parsed.length > 0);
        }

        return {
            output: new Filters(FilterCompoundOperator.AND, items), 
            scope, 
            issues, 
        };
    }

    protected scopeFor<RECORD extends ObjectLiteral = ObjectLiteral>(
        options: FiltersParseOptions<RECORD>,
        ledger: RelationLedger,
        issues?: IssueCollector,
    ) : FiltersScope<RECORD> {
        return ResolutionScope.for(this.registry, Parameter.FILTERS, options.schema, {
            relations: options.relations,
            throwOnFailure: options.throwOnFailure,
            strict: options.strict,
            obligationSink: ledger,
            issues,
        });
    }

    /**
     * The schema baseline, standing in for everything the client sent (or
     * for nothing at all). Only the former is worth reporting: defaults for
     * an absent parameter are ordinary operation, defaults REPLACING what the
     * client sent are the surprise.
     */
    protected defaults<RECORD extends ObjectLiteral = ObjectLiteral>(
        scope: FiltersScope<RECORD>,
        dropped: boolean,
    ) : ICondition[] {
        const output = buildFiltersDefaults(scope.schema);
        if (output.length > 0 && dropped) {
            scope.notice({
                code: ErrorCode.NONE,
                message: ErrorMessage.defaultsApplied(),
            });
        }

        return output;
    }

    parseTyped<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: SimpleFiltersParserInput<RECORD>,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters {
        return this.parse(input, options);
    }

    parseTypedAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: SimpleFiltersParserInput<RECORD>,
        options: FiltersParseOptions<RECORD> = {},
    ) : Promise<IFilters> {
        return this.parseAsync(input, options);
    }

    protected run<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        scope: ResolutionScope<`${Parameter.FILTERS}`, RECORD>,
    ) : IFilter[] {
        const { schema } = scope;

        // If it is an empty array nothing is allowed
        if (
            !schema.allowedIsUndefined &&
            schema.allowed.length === 0
        ) {
            return [];
        }

        if (!isObject(input)) {
            // absent input is not a failure — schema defaults still apply.
            if (
                typeof input !== 'undefined' &&
                input !== null
            ) {
                scope.refuse({
                    code: ErrorCode.INPUT_INVALID,
                    message: ErrorMessage.inputInvalid(),
                    input,
                });
            }

            return [];
        }

        const { length } = Object.keys(input);
        if (length === 0) {
            return [];
        }

        const normalized = this.groupObject(this.expandObject(input));

        const named = schema.name ? normalized.relations[schema.name] : undefined;
        if (schema.name && named) {
            normalized.attributes = {
                ...(normalized.attributes || {}),
                ...named.attributes,
            };
            normalized.relations = {
                ...(normalized.relations || {}),
                ...named.relations,
            };

            delete normalized.relations[schema.name];
        }

        return this.runFor(
            DEFAULT_ID,
            normalized,
            scope,
        );
    }

    protected runFor<RECORD extends ObjectLiteral = ObjectLiteral>(
        currentKey: string,
        data: TempType,
        scope: ResolutionScope<`${Parameter.FILTERS}`, RECORD>,
    ) : IFilter[] {
        const output : IFilter[] = [];

        let keys = Object.keys(data.attributes);
        for (const key_ of keys) {
            const key = parseKey(key_);

            const resolved = scope.resolveKey(key.name);
            if (!resolved.success) {
                continue;
            }

            const resolvedName = [...resolved.path, resolved.name].join('.');

            // the wire grammar owns value decoding, including the
            // empty-value verdict — the parser only applies the
            // schema drop-vs-throw policy.
            const decoded = decodeFilterWireValue(data.attributes[key_]);
            if (!decoded.success) {
                scope.refuse({
                    code: ErrorCode.KEY_VALUE_INVALID,
                    message: ErrorMessage.keyValueInvalid(resolvedName),
                    path: [...resolved.path, resolved.name],
                    key: key.name,
                    input: data.attributes[key_],
                });

                continue;
            }

            const filter = new Filter(
                decoded.condition.operator,
                currentKey === DEFAULT_ID ?
                    resolvedName :
                    stringifyKey({ path: currentKey, name: resolvedName }),
                decoded.condition.value,
            );

            output.push(filter);
        }

        keys = Object.keys(data.relations);
        for (const key of keys) {
            const child = scope.descend(key);
            if (!(child instanceof ResolutionScope)) {
                continue;
            }

            const relationData = data.relations[key];
            if (relationData === undefined) {
                continue;
            }

            const children = this.runFor(
                child.segment as string,
                relationData,
                child,
            );

            if (currentKey === DEFAULT_ID) {
                output.push(...children);
            } else {
                output.push(...children.map((child) => new Filter(
                    child.operator as `${FilterFieldOperator}`,
                    stringifyKey({ path: currentKey, name: child.field }),
                    child.value,
                )));
            }
        }

        return output;
    }
}
