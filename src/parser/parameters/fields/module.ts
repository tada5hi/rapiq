/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';
import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../base';
import {
    FieldOperator, FieldsSchema, Schema, defineFieldsSchema,
} from '../../../schema';
import { DEFAULT_ID } from '../../../constants';
import { FieldsParseError } from './error';
import {
    applyMapping, groupArrayByKeyPath, isPathAllowed,
} from '../../../utils';
import type { FieldsParseInputTransformed, FieldsParseOptions, FieldsParseOutput } from './types';
import { extractSubRelations } from '../../../schema/parameter/relations/helpers';

export class FieldsParser extends BaseParser<
FieldsParseOptions,
FieldsParseOutput
> {
    async parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: FieldsParseOptions<RECORD> = {},
    ) : Promise<FieldsParseOutput> {
        const schema = this.resolveSchema(options.schema);

        // If it is an empty array, nothing is allowed
        if (schema.allDenied) {
            return [];
        }

        const normalized = this.normalize(input, schema.throwOnFailure);
        if (
            schema.name &&
            normalized[schema.name]
        ) {
            normalized[DEFAULT_ID] = normalized[schema.name];
            delete normalized[schema.name];
        }

        const data = normalized[DEFAULT_ID] || [];
        delete normalized[DEFAULT_ID];

        const transformed : FieldsParseInputTransformed = {
            default: [],
            included: [],
            excluded: [],
        };

        if (data.length > 0) {
            for (let j = 0; j < data.length; j++) {
                let operator: FieldOperator | undefined;

                const character = data[j].substring(0, 1);
                if (
                    character === FieldOperator.INCLUDE ||
                    character === FieldOperator.EXCLUDE
                ) {
                    operator = character;

                    data[j] = data[j].substring(1);
                }

                data[j] = applyMapping(data[j], schema.mapping);

                if (!schema.isValid(data[j])) {
                    if (schema.throwOnFailure) {
                        throw FieldsParseError.keyNotPermitted(data[j]);
                    }

                    continue;
                }

                if (operator === FieldOperator.INCLUDE) {
                    transformed.included.push(data[j]);
                } else if (operator === FieldOperator.EXCLUDE) {
                    transformed.excluded.push(data[j]);
                } else {
                    transformed.default.push(data[j]);
                }
            }
        }

        if (
            options.isChild &&
            transformed.included.length === 0 &&
            transformed.default.length === 0
        ) {
            return [];
        }

        if (transformed.default.length === 0) {
            if (!schema.defaultIsUndefined) {
                transformed.default = schema.default as string[];
            }
        }

        if (
            transformed.included.length === 0 &&
            transformed.default.length === 0
        ) {
            if (!schema.allowedIsUndefined) {
                transformed.default = schema.allowed as string[];
            }
        }

        transformed.default = Array.from(new Set([
            ...transformed.default,
            ...transformed.included,
        ]));

        for (let j = 0; j < transformed.excluded.length; j++) {
            const index = transformed.default.indexOf(transformed.excluded[j]);
            if (index !== -1) {
                transformed.default.splice(index, 1);
            }
        }

        const output : FieldsParseOutput = [];

        if (transformed.default.length > 0) {
            for (let j = 0; j < transformed.default.length; j++) {
                output.push(transformed.default[j]);
            }
        }

        const keys = Object.keys(normalized);

        if (options.relations) {
            for (let i = 0; i < options.relations.length; i++) {
                const index = keys.indexOf(options.relations[i]);
                if (index === -1) {
                    keys.push(options.relations[i]);
                    normalized[options.relations[i]] = [];
                }
            }
        }

        const grouped : Record<string, Record<string, any>> = {};
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

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

            if (!grouped[group]) {
                grouped[group] = {};
            }

            grouped[group][relation] = normalized[key];
        }

        const groupedKeys = Object.keys(grouped);

        for (let i = 0; i < groupedKeys.length; i++) {
            const key = groupedKeys[i];

            if (!isPathAllowed(key, options.relations)) {
                if (schema.throwOnFailure) {
                    throw FieldsParseError.keyPathInvalid(key);
                }

                continue;
            }

            // todo: also pass options.schema
            const relationSchema = this.registry.resolve(schema.name, key);
            if (!relationSchema) {
                if (schema.throwOnFailure) {
                    throw FieldsParseError.keyPathInvalid(key);
                }

                continue;
            }

            let childRelations: string[] | undefined;
            if (typeof options.relations !== 'undefined') {
                childRelations = extractSubRelations(options.relations, key);
            }

            const relationOutput = await this.parse(
                grouped[key],
                {
                    schema: relationSchema,
                    relations: childRelations,
                },
            );

            output.push(...relationOutput.map(
                (element) => (`${key}.${element}`),
            ));
        }

        return output;
    }

    protected normalize(
        input: unknown,
        throwOnFailure?: boolean,
    ) : Record<string, string[]> {
        if (
            typeof input === 'string' ||
            Array.isArray(input)
        ) {
            let temp : unknown[] = [];
            if (typeof input === 'string') {
                temp = input.split(',');
            } else {
                temp = input;
            }

            const parts : string[] = [];
            for (let i = 0; i < temp.length; i++) {
                if (typeof temp[i] !== 'string') {
                    if (throwOnFailure) {
                        throw FieldsParseError.inputInvalid();
                    }

                    continue;
                }

                parts.push(temp[i] as string);
            }

            if (parts.length > 0) {
                return groupArrayByKeyPath(parts);
            }

            return {};
        }

        if (isObject(input)) {
            const output : Record<string, string[]> = {};

            const keys = Object.keys(input);
            for (let i = 0; i < keys.length; i++) {
                const temp = this.normalize(input[keys[i]], throwOnFailure);
                const tempKeys = Object.keys(temp);

                for (let j = 0; j < tempKeys.length; j++) {
                    let nextKey : string;
                    if (tempKeys[j] === DEFAULT_ID) {
                        nextKey = keys[i];
                    } else {
                        nextKey = `${keys[i]}.${tempKeys[j]}`;
                    }
                    output[nextKey] = temp[tempKeys[j]];
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

    // --------------------------------------------------

    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | FieldsSchema<RECORD>) : FieldsSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.getBaseSchema(input);
            return schema.fields;
        }

        if (input instanceof FieldsSchema) {
            return input;
        }

        return defineFieldsSchema();
    }
}
