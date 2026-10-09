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
    Parameter,
    RelationsParseError,
    ResolutionScope,
    Sort,
    SortDirection,
    Sorts,
    SortsParseError,
    applyKeySchemaValidation,
    applyKeySchemaValidationAsync,
    applySortsIndexPolicy,
    isObject,
    parseKey,
    pruneSortsByRelations,
    toIssuePath,
} from '@rapiq/core';
import type {
    IIssueCollector,
    ISorts,
    ObjectLiteral,
    PendingKeyValidation,
    RelationLedger,
    SortsParseOptions,
    SortsSchema,
} from '@rapiq/core';

type SortsScope<RECORD extends ObjectLiteral> = ResolutionScope<`${Parameter.SORTS}`, RECORD>;

export class SimpleSortsParser extends BaseParser<SortsParseOptions, ISorts> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: SortsParseOptions<RECORD> = {}) : Sorts {
        const ledger : RelationLedger = [];
        return this.withTrace({ parameter: Parameter.SORTS }, (issueCollector) => {
            const { output, scope } = this.build(input, options, ledger, issueCollector);

            return applySortsIndexPolicy(
                pruneSortsByRelations(output, applyKeySchemaValidation(ledger, options.context, {
                    throwOnFailure: scope.relationsThrowOnFailure,
                    errors: RelationsParseError,
                    issueCollector,
                }), scope.schema as SortsSchema<RECORD>),
                this.registry,
                options.schema,
                { throwOnFailure: options.throwOnFailure, issueCollector },
            );
        });
    }

    override async parseAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SortsParseOptions<RECORD> = {},
    ) : Promise<ISorts> {
        const ledger : RelationLedger = [];
        return this.withTraceAsync({ parameter: Parameter.SORTS }, async (issueCollector) => {
            const { output, scope } = await this.buildAsync(input, options, ledger, issueCollector);

            return applySortsIndexPolicy(
                pruneSortsByRelations(output, await applyKeySchemaValidationAsync(ledger, options.context, {
                    throwOnFailure: scope.relationsThrowOnFailure,
                    errors: RelationsParseError,
                    issueCollector,
                }), scope.schema as SortsSchema<RECORD>),
                this.registry,
                options.schema,
                { throwOnFailure: options.throwOnFailure, issueCollector },
            );
        });
    }

    parseParameter<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SortsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : ISorts {
        // whoever opens a trace raises it: driven by the query orchestrator
        // this records into the enclosing one and decides nothing, driven
        // directly it raises its own, so a violation never degrades into a
        // silent drop. A structural abort takes the same route out.
        return this.withTrace({ parameter: Parameter.SORTS, driver: issueCollector }, (collector) =>
            this.build(input, options, ledger, collector).output);
    }

    async parseParameterAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SortsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : Promise<ISorts> {
        return this.withTraceAsync({ parameter: Parameter.SORTS, driver: issueCollector }, async (collector) =>
            (await this.buildAsync(input, options, ledger, collector)).output);
    }

    protected build<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SortsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector: IIssueCollector,
    ) : {
        output: Sorts, 
        scope: SortsScope<RECORD>, 
    } {
        const scope = this.scopeFor(options, ledger, issueCollector);
        const pending : PendingKeyValidation[] = [];
        const output = this.parseWithScope(input, scope, pending);

        return {
            output: this.prune(output, applyKeySchemaValidation(pending, options.context, {
                throwOnFailure: scope.throwOnFailure,
                errors: SortsParseError,
                issueCollector,
            })),
            scope,
        };
    }

    protected async buildAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SortsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector: IIssueCollector,
    ) : Promise<{
        output: Sorts, 
        scope: SortsScope<RECORD>, 
    }> {
        const scope = this.scopeFor(options, ledger, issueCollector);
        const pending : PendingKeyValidation[] = [];
        const output = this.parseWithScope(input, scope, pending);

        return {
            output: this.prune(output, await applyKeySchemaValidationAsync(pending, options.context, {
                throwOnFailure: scope.throwOnFailure,
                errors: SortsParseError,
                issueCollector,
            })),
            scope,
        };
    }

    protected scopeFor<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        options: SortsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : SortsScope<RECORD> {
        return ResolutionScope.for(this.registry, Parameter.SORTS, options.schema, {
            relations: options.relations,
            throwOnFailure: options.throwOnFailure,
            strict: options.strict,
            obligationSink: ledger,
            issueCollector,
        });
    }

    protected prune(sorts: Sorts, rejected: string[]) : Sorts {
        if (rejected.length === 0) {
            return sorts;
        }

        return new Sorts(sorts.value.filter(
            (sort) => !rejected.includes(sort.name),
        ));
    }

    protected parseWithScope<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        scope: ResolutionScope<`${Parameter.SORTS}`, RECORD>,
        pending: PendingKeyValidation[],
    ) : Sorts {
        const { schema } = scope;

        const normalized = this.normalize(input, scope);
        const grouped = this.groupObjectByBasePath(normalized);
        if (schema.name) {
            const named = grouped[schema.name];
            if (named) {
                grouped[DEFAULT_ID] = named;
                delete grouped[schema.name];
            }
        }

        const output = new Sorts();

        const {
            [DEFAULT_ID]: data,
            ...relationsData
        } = grouped;

        if (data) {
            const keys = Object.keys(data);
            for (const key_ of keys) {
                const key = parseKey(key_);

                const resolved = scope.resolveKey(key.name);
                if (!resolved.success) {
                    continue;
                }

                const name = [...resolved.path, resolved.name].join('.');

                output.value.push(new Sort(name, data[key_]));
                pending.push({
                    key: resolved.name,
                    path: name,
                    schema: resolved.scope.schema,
                    // the governing scope's own policy, so a child schema's
                    // throwOnFailure applies to its validate rejections just
                    // as it already does to its allow-list failures.
                    throwOnFailure: resolved.scope.throwOnFailure,
                });
            }
        }

        if (output.value.length === 0) {
            output.value.push(...this.buildDefaults(schema).value);
        }

        const keys = Object.keys(relationsData);
        for (const key of keys) {
            const child = scope.descend(key);
            if (!(child instanceof ResolutionScope)) {
                continue;
            }

            const childPending : PendingKeyValidation[] = [];
            const relationOutput = this.parseWithScope(relationsData[key], child, childPending);

            for (const relation of relationOutput.value) {
                output.value.push(
                    new Sort(`${child.segment}.${relation.name}`, relation.operator),
                );
            }

            for (const entry of childPending) {
                pending.push({
                    ...entry,
                    path: `${child.segment}.${entry.path}`,
                });
            }
        }

        return output;
    }

    protected buildDefaults<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(schema: SortsSchema<RECORD>) {
        const output = new Sorts();

        if (schema.default) {
            const keys = Object.keys(schema.default);

            // defaults come out in the same shape as input-derived keys:
            // local names stay local, explicit dotted keys keep their path.
            for (const key_ of keys) {
                const fieldDetails = parseKey(key_);

                let key : string;
                if (fieldDetails.path) {
                    key = `${fieldDetails.path}.${fieldDetails.name}`;
                } else {
                    key = fieldDetails.name;
                }

                output.value.push(new Sort(key, schema.default[key_]));
            }

            return output;
        }

        return output;
    }

    /**
     * Return input normalized as
     * [KEY]: DIRECTION
     *
     * @param input
     * @param scope
     */
    protected normalize<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        scope: ResolutionScope<`${Parameter.SORTS}`, RECORD>,
        path: string[] = [...scope.path],
    ) : Record<string, SortDirection> {
        const output : Record<string, SortDirection> = Object.create(null);

        if (
            typeof input === 'string' ||
            Array.isArray(input)
        ) {
            let temp: unknown[];
            if (typeof input === 'string') {
                temp = input.split(',');
            } else {
                temp = input;
            }

            for (const key of temp) {
                if (typeof key !== 'string') {
                    scope.refuse({
                        code: ErrorCode.INPUT_INVALID,
                        message: ErrorMessage.inputInvalid(),
                        path,
                        input: key,
                    });

                    continue;
                }

                if (key.substring(0, 1) === '-') {
                    output[key.substring(1)] = SortDirection.DESC;
                } else {
                    output[key] = SortDirection.ASC;
                }
            }

            return output;
        }

        if (isObject(input)) {
            const keys = Object.keys(input);
            for (const key of keys) {
                const value = input[key];
                if (typeof value === 'string') {
                    const lowered = value.toLowerCase();
                    if (lowered === 'desc' || lowered === 'asc') {
                        output[key] = lowered === 'desc' ?
                            SortDirection.DESC :
                            SortDirection.ASC;

                        continue;
                    }
                }

                const temp = this.normalize(value, scope, [...path, ...toIssuePath(key)]);

                for (const [tempKey, value] of Object.entries(temp)) {
                    let nextKey : string;
                    if (tempKey === DEFAULT_ID) {
                        nextKey = key;
                    } else {
                        nextKey = `${key}.${tempKey}`;
                    }

                    output[nextKey] = value;
                }
            }

            return output;
        }

        if (input === undefined || input === null || input === '') {
            return {};
        }

        scope.refuse({
            code: ErrorCode.INPUT_INVALID,
            message: ErrorMessage.inputInvalid(),
            path,
            input,
        });

        return {};
    }
}

/**
 * @deprecated use {@link SimpleSortsParser}. Removed in 3.0.
 */
export const SimpleSortParser = SimpleSortsParser;

/**
 * @deprecated use {@link SimpleSortsParser}. Removed in 3.0.
 */
export type SimpleSortParser = SimpleSortsParser;
