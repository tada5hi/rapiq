/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    BaseParser,
    DEFAULT_ID,
    ErrorCode,
    ErrorMessage,
    Field,
    FieldOperator,
    Fields,
    FieldsParseError,
    Parameter,
    RelationsParseError,
    ResolutionScope,
    applyKeySchemaValidation,
    applyKeySchemaValidationAsync,
    isObject,
    pruneFieldsByRelations,
    toIssuePath,
} from '@rapiq/core';
import type {
    ICondition,
    IFields,
    IIssueCollector,
    ObjectLiteral,
    PendingKeyValidation,
    RelationLedger,
} from '@rapiq/core';
import type { SimpleFieldsParseOptions } from './types';

type FieldsScope<RECORD extends ObjectLiteral> = ResolutionScope<`${Parameter.FIELDS}`, RECORD>;

export class SimpleFieldsParser extends BaseParser<SimpleFieldsParseOptions, IFields> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD> = {},
    ) : IFields {
        const ledger : RelationLedger = [];
        return this.withTrace({ parameter: Parameter.FIELDS }, (issueCollector) => {
            const { output, scope } = this.build(input, options, ledger, issueCollector);

            return pruneFieldsByRelations(output, applyKeySchemaValidation(ledger, options.context, {
                throwOnFailure: scope.relationsThrowOnFailure,
                errors: RelationsParseError,
                issueCollector,
            }), issueCollector);
        });
    }

    override async parseAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD> = {},
    ) : Promise<IFields> {
        const ledger : RelationLedger = [];
        return this.withTraceAsync({ parameter: Parameter.FIELDS }, async (issueCollector) => {
            const { output, scope } = await this.buildAsync(input, options, ledger, issueCollector);

            return pruneFieldsByRelations(output, await applyKeySchemaValidationAsync(ledger, options.context, {
                throwOnFailure: scope.relationsThrowOnFailure,
                errors: RelationsParseError,
                issueCollector,
            }), issueCollector);
        });
    }

    parseParameter<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : IFields {
        // whoever opens a trace raises it: driven by the query orchestrator
        // this records into the enclosing one and decides nothing, driven
        // directly it raises its own, so a violation never degrades into a
        // silent drop. A structural abort takes the same route out.
        return this.withTrace({ parameter: Parameter.FIELDS, driver: issueCollector }, (collector) =>
            this.build(input, options, ledger, collector).output);
    }

    async parseParameterAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : Promise<IFields> {
        return this.withTraceAsync({ parameter: Parameter.FIELDS, driver: issueCollector }, async (collector) =>
            (await this.buildAsync(input, options, ledger, collector)).output);
    }

    /**
     * Resolve + leaf-validate into the (leaf-pruned) node, recording the relation
     * obligations it traverses into `ledger` (the scope's obligation sink).
     * Relation authorization stays with the caller: standalone `parse` self-
     * authorizes; the query orchestrator pools the ledger and authorizes once.
     */
    protected build<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector: IIssueCollector,
    ) : {
        output: IFields, 
        scope: FieldsScope<RECORD>, 
    } {
        const scope = this.scopeFor(options, ledger, issueCollector);
        const pending : PendingKeyValidation[] = [];
        const output = this.parseWithScope(input, scope, pending);
        const conditions = new Map<string, ICondition>();

        const rejected = applyKeySchemaValidation(pending, options.context, {
            throwOnFailure: scope.throwOnFailure,
            errors: FieldsParseError,
            conditions,
            issueCollector,
        });

        return {
            output: this.fallback(this.prune(output, rejected, conditions), output, rejected, options, ledger, issueCollector),
            scope,
        };
    }

    protected async buildAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector: IIssueCollector,
    ) : Promise<{
        output: IFields, 
        scope: FieldsScope<RECORD>, 
    }> {
        const scope = this.scopeFor(options, ledger, issueCollector);
        const pending : PendingKeyValidation[] = [];
        const output = this.parseWithScope(input, scope, pending);
        const conditions = new Map<string, ICondition>();

        const rejected = await applyKeySchemaValidationAsync(pending, options.context, {
            throwOnFailure: scope.throwOnFailure,
            errors: FieldsParseError,
            conditions,
            issueCollector,
        });

        return {
            output: this.fallback(this.prune(output, rejected, conditions), output, rejected, options, ledger, issueCollector),
            scope,
        };
    }

    /**
     * Every backend reads an empty fields node as "project everything", so a
     * validation pass that empties a client-narrowed projection would WIDEN
     * it to every column, including the rejected ones. Fall back to the
     * projection an input-less parse yields (defaults, or the allow-list
     * expansion), mirroring how an allow-list rejection already behaves and
     * the filters parser's defaults fallback. The rejected names are
     * subtracted from the fallback: unlike an allow-list failure, a validate
     * hook can deny a field the allow-list expansion would re-materialize,
     * and a denial must never resurrect. Defaults are server-authored and
     * bypass the hooks, so the re-derivation runs no validator and records
     * no obligations (nothing resolves client input).
     */
    protected fallback<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        pruned: IFields,
        parsed: IFields,
        rejected: string[],
        options: SimpleFieldsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : IFields {
        if (pruned.value.length > 0 || parsed.value.length === 0) {
            return pruned;
        }

        const output = this.parseWithScope(undefined, this.scopeFor(options, ledger, issueCollector), []);

        return new Fields(output.value.filter(
            (field) => !rejected.includes(field.name),
        ));
    }

    protected scopeFor<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        options: SimpleFieldsParseOptions<RECORD>,
        ledger: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : FieldsScope<RECORD> {
        return ResolutionScope.for(this.registry, Parameter.FIELDS, options.schema, {
            relations: options.relations,
            throwOnFailure: options.throwOnFailure,
            strict: options.strict,
            obligationSink: ledger,
            issueCollector,
        });
    }

    /**
     * Drop the rejected fields and attach the visibility condition of every
     * condition-gated one. The gated field stays projected: its condition
     * only restricts on which rows the value is visible, and is applied
     * after the fetch (`@rapiq/adapter-memory` honours it while projecting).
     */
    protected prune(
        fields: IFields,
        rejected: string[],
        conditions: Map<string, ICondition>,
    ) : IFields {
        if (rejected.length === 0 && conditions.size === 0) {
            return fields;
        }

        return new Fields(fields.value
            .filter((field) => !rejected.includes(field.name))
            .map((field) => {
                const condition = conditions.get(field.name);
                if (!condition) {
                    return field;
                }

                return new Field(field.name, field.operator, condition);
            }));
    }

    protected parseWithScope<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        scope: ResolutionScope<`${Parameter.FIELDS}`, RECORD>,
        pending: PendingKeyValidation[],
    ) : IFields {
        const { schema } = scope;

        const normalized = this.normalize(input, scope);

        if (schema.name) {
            const named = normalized[schema.name];
            if (named) {
                normalized[DEFAULT_ID] = named;
                delete normalized[schema.name];
            }
        }

        const data = normalized[DEFAULT_ID] || [];
        delete normalized[DEFAULT_ID];

        const fields = new Fields();

        if (data.length > 0) {
            for (let value of data) {
                let operator: FieldOperator | undefined;

                const character = value.substring(0, 1);
                if (
                    character === FieldOperator.INCLUDE ||
                    character === FieldOperator.EXCLUDE
                ) {
                    operator = character;

                    value = value.substring(1);
                }

                const resolved = scope.resolveKey(value);
                if (!resolved.success) {
                    continue;
                }

                if (resolved.path.length > 0) {
                    // a mapping alias expanded to a relation field —
                    // requeue it under its canonical group so the child
                    // schema semantics apply (like direct dotted input).
                    const group = resolved.path.join('.');
                    const list = normalized[group] ?? [];
                    normalized[group] = list;
                    list.push(`${operator ?? ''}${resolved.name}`);

                    continue;
                }

                fields.value.push(new Field(resolved.name, operator));

                // an excluded field never reaches the output — validating its
                // read access would be backwards (and could throw). The relations
                // it traverses are still authorized: the scope records them on
                // resolveKey above (the adapters auto-join any dotted field).
                if (operator !== FieldOperator.EXCLUDE) {
                    pending.push({
                        key: resolved.name,
                        path: resolved.name,
                        schema: resolved.scope.schema,
                        // the governing scope's own policy, so a child schema's
                        // throwOnFailure applies to its validate rejections just
                        // as it already does to its allow-list failures.
                        throwOnFailure: resolved.scope.throwOnFailure,
                    });
                }
            }
        }

        const output = fields.execute({
            default: schema.default,
            allowed: schema.allowed,
        });

        const keys = Object.keys(normalized);

        if (scope.relations) {
            for (const relation of scope.relations.value) {
                const index = keys.indexOf(relation.name);
                if (index === -1) {
                    keys.push(relation.name);
                    normalized[relation.name] = [];
                }
            }
        }

        // keyed by a client-controlled group: no prototype, so an
        // inherited member can never be mistaken for an existing group
        const grouped : Record<string, Record<string, any>> = Object.create(null);
        for (const key of keys) {
            let group : string;
            let relation : string;

            const index = key.indexOf('.');
            if (index === -1) {
                group = key;
                relation = DEFAULT_ID;
            } else {
                group = key.substring(0, index);
                relation = key.substring(index + 1);
            }

            const groupRecord = grouped[group] ?? Object.create(null);
            grouped[group] = groupRecord;
            groupRecord[relation] = normalized[key];
        }

        const groupedKeys = Object.keys(grouped);

        for (const key of groupedKeys) {
            const child = scope.descend(key);
            if (!(child instanceof ResolutionScope)) {
                continue;
            }

            const childPending : PendingKeyValidation[] = [];
            const relationOutput = this.parseWithScope(grouped[key], child, childPending);

            output.value.push(...relationOutput.value.map(
                (element) => new Field(`${child.segment}.${element.name}`, element.operator),
            ));

            for (const entry of childPending) {
                pending.push({
                    ...entry,
                    path: `${child.segment}.${entry.path}`,
                });
            }
        }

        // alias groups and the relations sub-tree may materialize
        // the same canonical field twice — keep the first occurrence.
        const seen = new Set<string>();
        const unique = output.value.filter((element) => {
            if (seen.has(element.name)) {
                return false;
            }

            seen.add(element.name);

            return true;
        });

        return new Fields(unique);
    }

    protected normalize<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        scope: ResolutionScope<`${Parameter.FIELDS}`, RECORD>,
        path: string[] = [...scope.path],
    ) : Record<string, string[]> {
        if (this.isTupleInput(input)) {
            return this.normalize({
                [DEFAULT_ID]: input[0],
                ...input[1],
            }, scope, path);
        }

        if (
            typeof input === 'string' ||
            Array.isArray(input)
        ) {
            let temp : unknown[];
            if (typeof input === 'string') {
                temp = input.split(',');
            } else {
                temp = input;
            }

            const parts : string[] = [];
            for (const element of temp) {
                if (typeof element !== 'string') {
                    scope.refuse({
                        code: ErrorCode.INPUT_INVALID,
                        message: ErrorMessage.inputInvalid(),
                        path,
                        input: element,
                    });

                    continue;
                }

                parts.push(element as string);
            }

            if (parts.length > 0) {
                return this.groupArrayByKeyPath(parts);
            }

            return {};
        }

        if (isObject(input)) {
            const output : Record<string, string[]> = Object.create(null);

            const keys = Object.keys(input);
            for (const key of keys) {
                const temp = this.normalize(input[key], scope, [...path, ...toIssuePath(key)]);
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

    protected isTupleInput(input: unknown) : input is [string[], Record<string, any>] {
        if (!Array.isArray(input) || input.length !== 2) {
            return false;
        }

        return Array.isArray(input[0]) && isObject(input[1]);
    }
}
