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
    IIssueCollector,
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
        return this.withTrace({ parameter: Parameter.FILTERS }, (issueCollector) => {
            const { output, scope } = this.build(input, options, ledger, issueCollector);

            return applyFiltersIndexPolicy(
                pruneFiltersByRelations(output, applyKeySchemaValidation(ledger, options.context, {
                    throwOnFailure: scope.relationsThrowOnFailure,
                    errors: RelationsParseError,
                    issueCollector,
                }), scope.schema as FiltersSchema<RECORD>, issueCollector),
                this.registry,
                options.schema,
                { throwOnFailure: options.throwOnFailure, issueCollector },
            );
        });
    }

    override async parseAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Promise<IFilters> {
        const ledger : RelationLedger = [];
        return this.withTraceAsync({ parameter: Parameter.FILTERS }, async (issueCollector) => {
            const { output, scope } = await this.buildAsync(input, options, ledger, issueCollector);

            return applyFiltersIndexPolicy(
                pruneFiltersByRelations(output, await applyKeySchemaValidationAsync(ledger, options.context, {
                    throwOnFailure: scope.relationsThrowOnFailure,
                    errors: RelationsParseError,
                    issueCollector,
                }), scope.schema as FiltersSchema<RECORD>, issueCollector),
                this.registry,
                options.schema,
                { throwOnFailure: options.throwOnFailure, issueCollector },
            );
        });
    }

    parseParameter<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : IFilters {
        // whoever opens a trace raises it: driven by the query orchestrator
        // this records into the enclosing one and decides nothing, driven
        // directly it raises its own, so a violation never degrades into a
        // silent drop. A structural abort takes the same route out.
        return this.withTrace({ parameter: Parameter.FILTERS, driver: issueCollector }, (collector) =>
            this.build(input, options, ledger, collector).output);
    }

    async parseParameterAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : Promise<IFilters> {
        return this.withTraceAsync({ parameter: Parameter.FILTERS, driver: issueCollector }, async (collector) =>
            (await this.buildAsync(input, options, ledger, collector)).output);
    }

    protected build<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector: IIssueCollector,
    ) : {
        output: IFilters, 
        scope: FiltersScope<RECORD>, 
    } {
        const scope = this.scopeFor(options, ledger, issueCollector);

        const parsed = this.run(input, scope);

        let items: ICondition[] = parsed;
        if (items.length > 0) {
            items = items
                .map((item) => applyFiltersSchemaValidation(item, scope.schema, options.context, {
                    issueCollector,
                    throwOnFailure: options.throwOnFailure,
                }))
                .filter((item): item is ICondition => typeof item !== 'undefined');
        }

        if (items.length === 0) {
            items = buildFiltersDefaults(scope.schema);
        }

        return {
            output: new Filters(FilterCompoundOperator.AND, items), 
            scope, 
        };
    }

    protected async buildAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector: IIssueCollector,
    ) : Promise<{
        output: IFilters, 
        scope: FiltersScope<RECORD>, 
    }> {
        const scope = this.scopeFor(options, ledger, issueCollector);

        const parsed = this.run(input, scope);

        let items: ICondition[] = [];
        for (const item of parsed) {
            const validated = await applyFiltersSchemaValidationAsync(item, scope.schema, options.context, {
                issueCollector,
                throwOnFailure: options.throwOnFailure,
            });
            if (validated) {
                items.push(validated);
            }
        }

        if (items.length === 0) {
            items = buildFiltersDefaults(scope.schema);
        }

        return {
            output: new Filters(FilterCompoundOperator.AND, items), 
            scope, 
        };
    }

    protected scopeFor<RECORD extends ObjectLiteral = ObjectLiteral>(
        options: FiltersParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : FiltersScope<RECORD> {
        return ResolutionScope.for(this.registry, Parameter.FILTERS, options.schema, {
            relations: options.relations,
            throwOnFailure: options.throwOnFailure,
            strict: options.strict,
            obligationSink: ledger,
            issueCollector,
        });
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
