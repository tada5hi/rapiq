/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    BaseParser,
    DEFAULT_ID,
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
} from '@rapiq/core';
import type {
    IFields,
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
        const { output, scope } = this.build(input, options, ledger);

        return pruneFieldsByRelations(output, applyKeySchemaValidation(ledger, options.context, {
            throwOnFailure: scope.relationsThrowOnFailure,
            errors: RelationsParseError,
        }));
    }

    override async parseAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD> = {},
    ) : Promise<IFields> {
        const ledger : RelationLedger = [];
        const { output, scope } = await this.buildAsync(input, options, ledger);

        return pruneFieldsByRelations(output, await applyKeySchemaValidationAsync(ledger, options.context, {
            throwOnFailure: scope.relationsThrowOnFailure,
            errors: RelationsParseError,
        }));
    }

    parseParameter<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD>,
        ledger: RelationLedger,
    ) : IFields {
        return this.build(input, options, ledger).output;
    }

    async parseParameterAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD>,
        ledger: RelationLedger,
    ) : Promise<IFields> {
        return (await this.buildAsync(input, options, ledger)).output;
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
    ) : { output: IFields, scope: FieldsScope<RECORD> } {
        const scope = this.scopeFor(options, ledger);
        const pending : PendingKeyValidation[] = [];
        const output = this.parseWithScope(input, scope, pending);

        return {
            output: this.prune(output, applyKeySchemaValidation(pending, options.context, {
                throwOnFailure: scope.throwOnFailure,
                errors: FieldsParseError,
            })),
            scope,
        };
    }

    protected async buildAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD>,
        ledger: RelationLedger,
    ) : Promise<{ output: IFields, scope: FieldsScope<RECORD> }> {
        const scope = this.scopeFor(options, ledger);
        const pending : PendingKeyValidation[] = [];
        const output = this.parseWithScope(input, scope, pending);

        return {
            output: this.prune(output, await applyKeySchemaValidationAsync(pending, options.context, {
                throwOnFailure: scope.throwOnFailure,
                errors: FieldsParseError,
            })),
            scope,
        };
    }

    protected scopeFor<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        options: SimpleFieldsParseOptions<RECORD>,
        ledger: RelationLedger,
    ) : FieldsScope<RECORD> {
        return ResolutionScope.for(this.registry, Parameter.FIELDS, options.schema, {
            relations: options.relations,
            throwOnFailure: options.throwOnFailure,
            strict: options.strict,
            obligationSink: ledger,
        });
    }

    protected prune(fields: IFields, rejected: string[]) : IFields {
        if (rejected.length === 0) {
            return fields;
        }

        return new Fields(fields.value.filter(
            (field) => !rejected.includes(field.name),
        ));
    }

    protected parseWithScope<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        scope: ResolutionScope<`${Parameter.FIELDS}`, RECORD>,
        pending: PendingKeyValidation[],
    ) : IFields {
        const { schema } = scope;

        // If it is an empty array, nothing is allowed
        if (schema.allDenied) {
            return new Fields();
        }

        const normalized = this.normalize(input, scope.throwOnFailure);

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

        const grouped : Record<string, Record<string, any>> = {};
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

            const groupRecord = grouped[group] ?? {};
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

    protected normalize(
        input: unknown,
        throwOnFailure?: boolean,
    ) : Record<string, string[]> {
        if (this.isTupleInput(input)) {
            return this.normalize({
                [DEFAULT_ID]: input[0],
                ...input[1],
            });
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
                    if (throwOnFailure) {
                        throw FieldsParseError.inputInvalid();
                    }

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
            const output : Record<string, string[]> = {};

            const keys = Object.keys(input);
            for (const key of keys) {
                const temp = this.normalize(input[key], throwOnFailure);
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

        if (throwOnFailure) {
            throw FieldsParseError.inputInvalid();
        }

        return {};
    }

    protected isTupleInput(input: unknown) : input is [string[], Record<string, any>] {
        if (!Array.isArray(input) || input.length !== 2) {
            return false;
        }

        return Array.isArray(input[0]) && isObject(input[1]);
    }
}
