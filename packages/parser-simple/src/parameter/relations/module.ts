/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BaseParser,
    DEFAULT_ID,
    Parameter,
    Relation,
    Relations,
    RelationsParseError,
    ResolutionScope,
    applyKeySchemaValidation,
    applyKeySchemaValidationAsync,
    isObject,
    parseKey,
} from '@rapiq/core';
import type {
    IRelations,
    ObjectLiteral,
    PendingKeyValidation,
    RelationsParseOptions,
} from '@rapiq/core';

// --------------------------------------------------

export class SimpleRelationsParser extends BaseParser<
    RelationsParseOptions,
    IRelations
> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: RelationsParseOptions<RECORD> = {},
    ) : Relations {
        const scope = ResolutionScope.for(this.registry, Parameter.RELATIONS, options.schema, {
            throwOnFailure: options.throwOnFailure,
            strict: options.strict,
        });

        const pending : PendingKeyValidation[] = [];
        const output = this.parseWithScope(input, scope, pending);

        const rejected = applyKeySchemaValidation(pending, options.context, {
            throwOnFailure: scope.throwOnFailure,
            errors: RelationsParseError,
        });

        return this.prune(output, rejected);
    }

    override async parseAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: RelationsParseOptions<RECORD> = {},
    ) : Promise<IRelations> {
        const scope = ResolutionScope.for(this.registry, Parameter.RELATIONS, options.schema, {
            throwOnFailure: options.throwOnFailure,
            strict: options.strict,
        });

        const pending : PendingKeyValidation[] = [];
        const output = this.parseWithScope(input, scope, pending);

        const rejected = await applyKeySchemaValidationAsync(pending, options.context, {
            throwOnFailure: scope.throwOnFailure,
            errors: RelationsParseError,
        });

        return this.prune(output, rejected);
    }

    /**
     * A rejected relation also drops every deeper relation reached
     * through it.
     */
    protected prune(relations: Relations, rejected: string[]) : Relations {
        if (rejected.length === 0) {
            return relations;
        }

        return new Relations(relations.value.filter(
            (relation) => !rejected.some(
                (name) => relation.name === name ||
                    relation.name.startsWith(`${name}.`),
            ),
        ));
    }

    protected parseWithScope<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        scope: ResolutionScope<`${Parameter.RELATIONS}`, RECORD>,
        pending: PendingKeyValidation[],
    ) : Relations {
        const { schema } = scope;

        const output = new Relations();

        // If it is an empty array nothing is allowed
        if (
            Array.isArray(schema.allowed) &&
            schema.allowed.length === 0
        ) {
            return output;
        }

        const normalized = this.includeParents(this.normalize(input, scope.throwOnFailure));
        const grouped = this.groupArrayByBasePath(normalized);

        const {
            [DEFAULT_ID]: data,
            ...relationsData
        } = grouped;

        if (data) {
            for (const datum of data) {
                const key = parseKey(datum);

                const resolved = scope.resolveKey(key.name);
                if (!resolved.success) {
                    continue;
                }

                const name = [...resolved.path, resolved.name].join('.');

                output.value.push(new Relation(name));
                pending.push({
                    key: resolved.name,
                    path: name,
                    schema: resolved.scope.schema,
                });
            }
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
                    new Relation(`${child.segment}.${relation.name}`),
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

    // --------------------------------------------------

    protected normalize(input: unknown, throwOnFailure?: boolean) : string[] {
        const output: string[] = [];

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
                    if (throwOnFailure) {
                        throw RelationsParseError.inputInvalid();
                    }

                    continue;
                }

                output.push(key);
            }

            return output;
        }

        if (isObject(input)) {
            const keys = Object.keys(input);
            for (const key of keys) {
                if (typeof input[key] === 'string') {
                    const path = `${key}.${input[key]}`;

                    output.push(path);
                }
            }

            return output;
        }

        if (input === undefined || input === null || input === '') {
            return [];
        }

        if (throwOnFailure) {
            throw RelationsParseError.inputInvalid();
        }

        return [];
    }

    protected includeParents(
        data: string[],
    ) : string[] {
        const output : string[] = [...data].reverse();

        for (const datum of data) {
            const parts: string[] = datum.split('.');

            while (parts.length > 0) {
                parts.pop();

                if (parts.length > 0) {
                    const value = parts.join('.');
                    if (!output.includes(value)) {
                        output.push(value);
                    }
                }
            }
        }

        return output.reverse();
    }
}
