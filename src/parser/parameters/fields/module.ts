/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { distinctArray, isObject } from 'smob';
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
import { RelationsParseError } from '../relations';

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

        // If it is an empty array nothing is allowed
        if (schema.allDenied) {
            return [];
        }

        let data : Record<string, any> = {};

        if (
            typeof input === 'string' ||
            Array.isArray(input)
        ) {
            if (typeof input === 'string') {
                input = groupArrayByKeyPath(input.split(','));
            } else {
                const parts : string[] = [];
                for (let i = 0; i < input.length; i++) {
                    if (typeof input[i] === 'string') {
                        parts.push(input[i]);
                        continue;
                    }

                    if (schema.throwOnFailure) {
                        throw RelationsParseError.inputInvalid();
                    }
                }

                input = groupArrayByKeyPath(parts);
            }
        }

        if (isObject(input)) {
            if (
                schema.defaultPath &&
                input[schema.defaultPath]
            ) {
                input[DEFAULT_ID] = input[schema.defaultPath];
                delete input[schema.defaultPath];
            }

            data = input;
        } else if (schema.throwOnFailure) {
            throw FieldsParseError.inputInvalid();
        }

        const allowedKeys = [
            DEFAULT_ID,
            ...schema.allowedKeys,
            ...schema.defaultKeys,
        ];

        let keys = Object.keys(data);
        if (keys.length > 0) {
            for (let i = 0; i < keys.length; i++) {
                const index = allowedKeys.indexOf(keys[i]);

                if (index === -1) {
                    if (schema.throwOnFailure) {
                        throw FieldsParseError.keyPathInvalid(keys[i]);
                    }
                }
            }
        } else if (typeof options.relations !== 'undefined') {
            keys = options.relations;
        } else {
            keys = allowedKeys;
        }

        keys = distinctArray([DEFAULT_ID, ...keys]);

        const output : FieldsParseOutput = [];

        while (keys.length > 0) {
            const path = keys.shift();

            if (!path || path === schema.defaultPath) {
                continue;
            }

            const pathValid = path === DEFAULT_ID ||
                isPathAllowed(path, options.relations);

            if (!pathValid) {
                if (schema.throwOnFailure) {
                    throw FieldsParseError.keyPathInvalid(path);
                }

                continue;
            }

            let key : string;
            const index = path.indexOf('.');
            if (index !== -1) {
                key = path.slice(0, index);
            } else {
                key = path;
            }

            if (key !== DEFAULT_ID) {
                const relationSchemaName = schema.mapSchema(key);
                const relationSchema = this.registry.get(relationSchemaName);

                if (relationSchema) {
                    let childRelations: string[] | undefined;
                    if (typeof options.relations !== 'undefined') {
                        childRelations = extractSubRelations(options.relations, key);
                    }

                    // todo: this is risky
                    extractSubRelations(keys, key);

                    const subOutput = this.parse(
                        this.prepareInputForSubSchema(data, key),
                        {
                            relations: childRelations,
                            schema: relationSchema,
                            isChild: true,
                        },
                    );

                    output.push(...subOutput.map(
                        (element) => ({
                            key: element.key,
                            path: element.path ? `${key}.${element.path}` : key,
                        }),
                    ));

                    continue;
                }
            }

            let fields : string[] = [];
            if (hasOwnProperty(data, path)) {
                fields = this.parseInputGroup(data[path]);
            } else if (
                hasOwnProperty(schema.reverseMapping, path) &&
                hasOwnProperty(data, schema.reverseMapping[path])
            ) {
                fields = this.parseInputGroup(data[schema.reverseMapping[path]]);
            }

            const transformed : FieldsParseInputTransformed = {
                default: [],
                included: [],
                excluded: [],
            };

            if (fields.length > 0) {
                for (let j = 0; j < fields.length; j++) {
                    let operator: FieldOperator | undefined;

                    const character = fields[j].substring(0, 1);

                    if (character === FieldOperator.INCLUDE) {
                        operator = FieldOperator.INCLUDE;
                    } else if (character === FieldOperator.EXCLUDE) {
                        operator = FieldOperator.EXCLUDE;
                    }

                    if (operator) {
                        fields[j] = fields[j].substring(1);
                    }

                    fields[j] = applyMapping(fields[j], schema.mapping, true);

                    if (!schema.isValid(fields[j], path)) {
                        if (schema.throwOnFailure) {
                            throw FieldsParseError.keyNotAllowed(fields[j]);
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
                    schema.defaultPath &&
                    hasOwnProperty(schema.default, schema.defaultPath)
                ) {
                    transformed.default = schema.default[schema.defaultPath];
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
                    schema.defaultPath &&
                    hasOwnProperty(schema.allowed, schema.defaultPath)
                ) {
                    transformed.default = schema.allowed[schema.defaultPath];
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
                    let destPath : string | undefined;
                    if (
                        path !== DEFAULT_ID &&
                        path !== schema.defaultPath
                    ) {
                        destPath = path;
                    }

                    output.push({
                        key: transformed.default[j],
                        ...(destPath ? { path: destPath } : {}),
                    });
                }
            }
        }

        return output;
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

    protected parseInputGroup(input: unknown): string[] {
        let output: string[] = [];

        if (typeof input === 'string') {
            output = input.split(',');
        } else if (Array.isArray(input)) {
            for (let i = 0; i < input.length; i++) {
                if (typeof input[i] === 'string') {
                    output.push(input[i]);
                }
            }
        }

        return output;
    }

    // --------------------------------------------------

    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | FieldsSchema<RECORD>) : FieldsSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.resolveBaseSchema(input);
            return schema.fields;
        }

        if (input instanceof FieldsSchema) {
            return input;
        }

        return defineFieldsSchema();
    }
}
