/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';
import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../module';
import {
    FieldOperator, FieldsSchema, Schema, defineFieldsSchema,
} from '../../../schema';
import { DEFAULT_ID } from '../../../constants';
import { FieldsParseError } from './error';
import {
    applyMapping, hasOwnProperty, isPathAllowedByRelations,
} from '../../../utils';
import type { RelationsParseOutput } from '../relations';
import type { FieldsParseInputTransformed, FieldsParseOutput } from './types';

type FieldsParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    relations?: RelationsParseOutput,
    schema?: string | Schema<RECORD> | FieldsSchema<RECORD>
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

        const defaultKey = schema.defaultPath || DEFAULT_ID;

        let data : Record<string, any> = {};

        if (isObject(input)) {
            if (
                input[DEFAULT_ID] &&
                DEFAULT_ID !== defaultKey
            ) {
                input[defaultKey] = input[DEFAULT_ID];
                delete input[DEFAULT_ID];
            }

            data = input;
        } else if (
            typeof input === 'string' ||
            Array.isArray(input)
        ) {
            data = {
                [defaultKey]: input,
            };
        } else if (schema.throwOnFailure) {
            throw FieldsParseError.inputInvalid();
        }

        let keys : string[];

        if (
            schema.allowedIsUndefined &&
            schema.defaultIsUndefined
        ) {
            keys = Object.keys(data);
        } else {
            keys = Array.from(new Set([
                ...schema.allowedKeys,
                ...schema.defaultKeys,
                ...Object.keys(data),
            ]));
        }

        const output : FieldsParseOutput = [];

        for (let i = 0; i < keys.length; i++) {
            const path = keys[i];

            if (
                path !== defaultKey &&
                !isPathAllowedByRelations(path, options.relations)
            ) {
                if (schema.throwOnFailure) {
                    throw FieldsParseError.keyPathInvalid(path);
                }

                continue;
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
                    if (
                        path !== DEFAULT_ID &&
                        path !== defaultKey
                    ) {
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
