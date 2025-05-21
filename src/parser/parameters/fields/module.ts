/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { distinctArray, isObject } from 'smob';
import { BaseParser } from '../../module';
import {
    FieldOperator, FieldsSchema, Schema, defineFieldsSchema,
} from '../../../schema';
import { DEFAULT_ID } from '../../../constants';
import { FieldsParseError } from './error';
import {
    applyMapping, hasOwnProperty, isPathAllowedByRelations, isPropertyNameValid,
} from '../../../utils';
import type { RelationsParseOutput } from '../relations';
import type { FieldsParseInputTransformed, FieldsParseOutput } from './types';

type FieldsParseOptions = {
    relations?: RelationsParseOutput,
    schema?: string | Schema | FieldsSchema
};

export class FieldsParser extends BaseParser<
FieldsParseOptions,
FieldsParseOutput
> {
    parse(
        input: unknown,
        options: FieldsParseOptions = {},
    ) : FieldsParseOutput {
        const schema = this.resolveSchema(options.schema);

        // If it is an empty array nothing is allowed
        if (
            (!schema.allowedIsUndefined || !schema.defaultIsUndefined) &&
            schema.keys.length === 0
        ) {
            return [];
        }

        let data : Record<string, any> = {
            [DEFAULT_ID]: [],
        };

        if (isObject(input)) {
            data = input;
        } else if (typeof input === 'string' || Array.isArray(input)) {
            data = { [DEFAULT_ID]: input };
        } else if (schema.throwOnFailure) {
            throw FieldsParseError.inputInvalid();
        }

        let { keys } = schema;

        if (
            keys.length > 0 &&
            hasOwnProperty(data, DEFAULT_ID)
        ) {
            data = {
                [keys[0]]: data[DEFAULT_ID],
            };
        } else {
            keys = distinctArray([...keys, ...Object.keys(data)]);
        }

        const output : FieldsParseOutput = [];

        for (let i = 0; i < keys.length; i++) {
            const path = keys[i];

            if (
                path !== DEFAULT_ID &&
                !isPathAllowedByRelations(path, options.relations)
            ) {
                if (schema.throwOnFailure) {
                    throw FieldsParseError.keyPathInvalid(path);
                }

                continue;
            }

            let fields : string[] = [];

            if (hasOwnProperty(data, path)) {
                fields = this.parseFieldsInput(data[path]);
            } else if (
                hasOwnProperty(schema.reverseMapping, path) &&
                hasOwnProperty(data, schema.reverseMapping[path])
            ) {
                fields = this.parseFieldsInput(data[schema.reverseMapping[path]]);
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

                    let isValid : boolean;
                    if (hasOwnProperty(schema.items, path)) {
                        isValid = schema.items[path].indexOf(fields[j]) !== -1;
                    } else {
                        isValid = isPropertyNameValid(fields[j]);
                    }

                    if (!isValid) {
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
                transformed.default.length === 0 &&
                hasOwnProperty(schema.default, path)
            ) {
                transformed.default = schema.default[path];
            }

            if (
                transformed.included.length === 0 &&
                transformed.default.length === 0 &&
                hasOwnProperty(schema.allowed, path)
            ) {
                transformed.default = schema.allowed[path];
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
                    if (path !== DEFAULT_ID) {
                        destPath = path;
                    } else if (schema.defaultPath) {
                        destPath = schema.defaultPath;
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

    protected parseFieldsInput(input: unknown): string[] {
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

    protected resolveSchema(input?: string | Schema | FieldsSchema) : FieldsSchema {
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
