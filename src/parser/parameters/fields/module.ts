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
    applyMapping, groupArrayByKeyPath, hasOwnProperty, isPathAllowed,
} from '../../../utils';
import type { FieldsParseInputTransformed, FieldsParseOutput } from './types';
import { extractSubRelations } from '../../../schema/parameter/relations/helpers';

type FieldsParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    relations?: string[],
    schema?: string | Schema<RECORD> | FieldsSchema<RECORD>,
    isChild?: boolean
};

export class FieldsParser extends BaseParser<
FieldsParseOptions,
FieldsParseOutput
> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: FieldsParseOptions<RECORD> = {},
    ) : FieldsParseOutput {
        const schema = this.resolveSchema(options.schema);

        // If it is an empty array, nothing is allowed
        if (schema.allDenied) {
            return [];
        }

        const data = this.normalize(input, schema.throwOnFailure);
        if (
            schema.name &&
            data[schema.name]
        ) {
            data[DEFAULT_ID] = data[schema.name];
            delete data[schema.name];
        }

        const allowedKeys = [
            ...schema.allowedKeys,
            ...schema.defaultKeys,
        ];

        let keys = Object.keys(data);
        if (keys.length > 0) {
            const temp : string[] = [];
            for (let i = 0; i < keys.length; i++) {
                const index = allowedKeys.indexOf(keys[i]);

                if (index === -1) {
                    // todo: also pass options.schema
                    const keySchema = this.registry.resolve(schema.name, keys[i]);
                    if (!keySchema) {
                        if (schema.throwOnFailure) {
                            throw FieldsParseError.keyPathInvalid(keys[i]);
                        }
                        continue;
                    }
                }

                if (!isPathAllowed(keys[i], options.relations)) {
                    if (schema.throwOnFailure) {
                        throw FieldsParseError.keyPathInvalid(keys[i]);
                    }

                    continue;
                }

                if (keys[i] === DEFAULT_ID) {
                    continue;
                }

                temp.push(keys[i]);
            }

            keys = [DEFAULT_ID, ...temp];
        } else if (typeof options.relations !== 'undefined') {
            keys = [DEFAULT_ID, ...options.relations];
        } else {
            keys = [DEFAULT_ID];
        }

        const output : FieldsParseOutput = [];

        while (keys.length > 0) {
            const path = keys.shift() as string;

            if (path !== DEFAULT_ID) {
                // todo: also pass options.schema
                const relationSchema = this.registry.resolve(schema.name, path);
                if (relationSchema) {
                    let childRelations: string[] | undefined;
                    if (typeof options.relations !== 'undefined') {
                        childRelations = extractSubRelations(options.relations, path);
                    }

                    const subOutput = this.parse(
                        this.prepareInputForSubSchema(data, path),
                        {
                            relations: childRelations,
                            schema: relationSchema,
                            isChild: true,
                        },
                    );

                    output.push(...subOutput.map(
                        (element) => ({
                            key: element.key,
                            path: element.path ? `${path}.${element.path}` : path,
                        }),
                    ));

                    extractSubRelations(keys, path);

                    continue;
                }
            }

            const transformed : FieldsParseInputTransformed = {
                default: [],
                included: [],
                excluded: [],
            };

            if (
                data[path] &&
                data[path].length > 0
            ) {
                const fields = data[path];
                for (let j = 0; j < fields.length; j++) {
                    let operator: FieldOperator | undefined;

                    const character = fields[j].substring(0, 1);
                    if (
                        character === FieldOperator.INCLUDE ||
                        character === FieldOperator.EXCLUDE
                    ) {
                        operator = character;

                        fields[j] = fields[j].substring(1);
                    }

                    fields[j] = applyMapping(fields[j], schema.mapping);

                    if (!schema.isValid(fields[j], path)) {
                        if (schema.throwOnFailure) {
                            throw FieldsParseError.keyNotPermitted(fields[j]);
                        }

                        continue;
                    }

                    if (operator === FieldOperator.INCLUDE) {
                        transformed.included.push(fields[j]);
                    } else if (operator === FieldOperator.EXCLUDE) {
                        transformed.excluded.push(fields[j]);
                    } else {
                        transformed.default.push(fields[j]);
                    }
                }
            }

            if (
                options.isChild &&
                transformed.included.length === 0 &&
                transformed.default.length === 0
            ) {
                continue;
            }

            if (transformed.default.length === 0) {
                if (hasOwnProperty(schema.default, path)) {
                    transformed.default = schema.default[path];
                } else if (
                    path === DEFAULT_ID &&
                    schema.name &&
                    hasOwnProperty(schema.default, schema.name)
                ) {
                    transformed.default = schema.default[schema.name];
                }
            }

            if (
                transformed.included.length === 0 &&
                transformed.default.length === 0
            ) {
                if (hasOwnProperty(schema.allowed, path)) {
                    transformed.default = schema.allowed[path];
                } else if (
                    path === DEFAULT_ID &&
                    schema.name &&
                    hasOwnProperty(schema.allowed, schema.name)
                ) {
                    transformed.default = schema.allowed[schema.name];
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

            if (transformed.default.length > 0) {
                for (let j = 0; j < transformed.default.length; j++) {
                    output.push({
                        key: transformed.default[j],
                        ...(path !== DEFAULT_ID ? { path } : {}),
                    });
                }
            }
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

    protected prepareInputForSubSchema(data: Record<string, any>, relation: string) {
        const output : Record<string, any> = {};

        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] === relation) {
                output[DEFAULT_ID] = data[keys[i]];
                continue;
            }

            if (keys[i].substring(0, relation.length + 1) === `${relation}.`) {
                output[keys[i].substring(relation.length + 1)] = data[keys[i]];
            }
        }

        return output;
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
