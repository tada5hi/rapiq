/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BaseRelationsParser,
    DEFAULT_ID,
    Relation,
    Relations,
    RelationsParseError,
    SortParseError,
    applyMapping,
    isObject,
    isPathAllowed, 
    parseKey,
} from '@rapiq/core';
import type {
    ObjectLiteral, 
    RelationsParseOptions,
    Schema,
} from '@rapiq/core';

// --------------------------------------------------

export class SimpleRelationsParser extends BaseRelationsParser<
    RelationsParseOptions
> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: RelationsParseOptions<RECORD> = {},
    ) : Relations {
        const schema = this.resolveSchema(options.schema);
        const throwOnFailure = options.throwOnFailure ?? schema?.throwOnFailure;

        const output = new Relations();

        // If it is an empty array nothing is allowed
        if (
            schema &&
            Array.isArray(schema.allowed) &&
            schema.allowed.length === 0
        ) {
            return output;
        }

        const normalized = this.includeParents(this.normalize(input, throwOnFailure));
        const grouped = this.groupArrayByBasePath(normalized);

        const {
            [DEFAULT_ID]: data,
            ...relationsData
        } = grouped;

        if (data) {
            for (const datum of data) {
                const key = parseKey(datum);
                if (schema) {
                    key.name = applyMapping(key.name, schema.mapping);

                    if (!isPathAllowed(key.name, schema.allowed)) {
                        if (schema.throwOnFailure) {
                            throw RelationsParseError.keyInvalid(key.name);
                        }

                        continue;
                    } else if (
                        typeof schema.allowed === 'undefined' &&
                        !this.isValidPath(key.name)
                    ) {
                        if (throwOnFailure) {
                            throw RelationsParseError.keyInvalid(key.name);
                        }

                        continue;
                    }
                } else if (!this.isValidPath(key.name)) {
                    if (throwOnFailure) {
                        throw RelationsParseError.keyInvalid(key.name);
                    }

                    continue;
                }

                output.value.push(new Relation(key.name));
            }
        }

        const keys = Object.keys(relationsData);
        for (const key_ of keys) {
            let key : string;
            let relationSchema : string | Schema | undefined;

            if (schema) {
                key = applyMapping(key_, schema.mapping);

                if (!isPathAllowed(key, schema.allowed)) {
                    if (throwOnFailure) {
                        throw RelationsParseError.keyPathInvalid(key);
                    }

                    continue;
                }

                relationSchema = this.registry.resolve(schema.name, key);
            } else {
                key = key_;
            }

            // todo: also pass options.schema

            const relationOutput = this.parse(
                relationsData[key_],
                {
                    schema: relationSchema,
                    throwOnFailure: options.throwOnFailure,
                },
            );

            for (let j = 0; j < relationOutput.value.length; j++) {
                output.value.push(
                    new Relation(`${key}.${relationOutput.value[j].name}`),
                );
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
                        throw SortParseError.inputInvalid();
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

    protected isValidPath(input: string) : boolean {
        return /^[a-zA-Z0-9_-]+([.]*[a-zA-Z0-9_-])*$/gu.test(input);
    }
}
