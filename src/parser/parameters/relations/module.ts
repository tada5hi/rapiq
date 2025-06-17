/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID } from '../../../constants';
import type { ObjectLiteral } from '../../../types';
import {
    applyMapping, isObject, isPathAllowed, parseKey,
} from '../../../utils';
import { SortParseError } from '../sort';
import { RelationsParseError } from './error';
import { BaseParser } from '../../base';
import {
    RelationsSchema, Schema, defineRelationsSchema,
} from '../../../schema';
import type { RelationsParseOutput } from './types';

// --------------------------------------------------

type RelationsParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    throwOnFailure?: boolean,
    schema?: string | Schema<RECORD> | RelationsSchema<RECORD>
};

export class RelationsParser extends BaseParser<
RelationsParseOptions,
RelationsParseOutput
> {
    parse<
    RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: RelationsParseOptions<RECORD> = {},
    ) : RelationsParseOutput {
        const schema = this.resolveSchema(options.schema);
        const throwOnFailure = options.throwOnFailure ?? schema.throwOnFailure;

        // If it is an empty array nothing is allowed
        if (
            Array.isArray(schema.allowed) &&
            schema.allowed.length === 0
        ) {
            return [];
        }

        const normalized = this.includeParents(this.normalize(input, throwOnFailure));
        const grouped = this.groupArrayByBasePath(normalized);

        const output : RelationsParseOutput = [];

        const {
            [DEFAULT_ID]: data,
            ...relationsData
        } = grouped;
        if (data) {
            for (let i = 0; i < data.length; i++) {
                const key = parseKey(data[i]);
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

                output.push(key.name);
            }
        }

        const keys = Object.keys(relationsData);
        for (let i = 0; i < keys.length; i++) {
            const key = applyMapping(keys[i], schema.mapping);

            if (!isPathAllowed(key, schema.allowed)) {
                if (throwOnFailure) {
                    throw RelationsParseError.keyPathInvalid(key);
                }

                continue;
            }

            // todo: also pass options.schema
            const relationSchema = this.registry.resolve(schema.name, key);
            if (!relationSchema) {
                if (throwOnFailure) {
                    throw RelationsParseError.keyPathInvalid(key);
                }

                continue;
            }

            const relationOutput = this.parse(
                relationsData[keys[i]],
                {
                    schema: relationSchema,
                    throwOnFailure: options.throwOnFailure,
                },
            );

            output.push(...relationOutput.map(
                (element) => (`${key}.${element}`),
            ));
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
            let temp: unknown[] = [];
            if (typeof input === 'string') {
                temp = input.split(',');
            } else {
                temp = input;
            }

            for (let i = 0; i < temp.length; i++) {
                const key = temp[i];
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
            for (let i = 0; i < keys.length; i++) {
                if (typeof input[keys[i]] === 'string') {
                    const path = `${keys[i]}.${input[keys[i]]}`;

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
        const output : string[] = [
            ...data,
        ];

        for (let i = 0; i < data.length; i++) {
            const parts: string[] = data[i].split('.');

            while (parts.length > 0) {
                parts.pop();

                if (parts.length > 0) {
                    const value = parts.join('.');
                    if (output.indexOf(value) === -1) {
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

    // --------------------------------------------------

    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | RelationsSchema<RECORD>) : RelationsSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.getBaseSchema(input);
            return schema.relations;
        }

        if (input instanceof RelationsSchema) {
            return input;
        }

        return defineRelationsSchema();
    }
}
