/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { distinctArray, isObject } from 'smob';
import type { RelationsParseOutput } from '../../parameter/relations';
import { BaseParser } from '../module';
import type { Schema, SchemaOptions } from '../../schema';
import { DEFAULT_ID } from '../../constants';
import { FieldsParseError } from '../../parameter/fields/errors';
import { applyMapping, hasOwnProperty, isPathAllowedByRelations } from '../../utils';
import type { FieldsInputTransformed, FieldsParseOutput } from '../../parameter/fields/types';
import { isValidFieldName, parseFieldsInput } from '../../parameter/fields/utils';
import { FieldOperator } from '../../parameter/fields/constants';

type FieldsParseOptions = {
    relations?: RelationsParseOutput,
    schema?: string | Schema | SchemaOptions
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

        const container = schema.fields;

        // If it is an empty array nothing is allowed
        if (
            (!container.allowedIsUndefined || !container.defaultIsUndefined) &&
            container.keys.length === 0
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
        } else if (container.throwOnFailure) {
            throw FieldsParseError.inputInvalid();
        }

        let { keys } = container;

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
                if (container.throwOnFailure) {
                    throw FieldsParseError.keyPathInvalid(path);
                }

                continue;
            }

            let fields : string[] = [];

            if (hasOwnProperty(data, path)) {
                fields = parseFieldsInput(data[path]);
            } else if (
                hasOwnProperty(container.reverseMapping, path) &&
                hasOwnProperty(data, container.reverseMapping[path])
            ) {
                fields = parseFieldsInput(data[container.reverseMapping[path]]);
            }

            const transformed : FieldsInputTransformed = {
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

                    fields[j] = applyMapping(fields[j], container.mapping, true);

                    let isValid : boolean;
                    if (hasOwnProperty(container.items, path)) {
                        isValid = container.items[path].indexOf(fields[j]) !== -1;
                    } else {
                        isValid = isValidFieldName(fields[j]);
                    }

                    if (!isValid) {
                        if (container.throwOnFailure) {
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
                hasOwnProperty(container.default, path)
            ) {
                transformed.default = container.default[path];
            }

            if (
                transformed.included.length === 0 &&
                transformed.default.length === 0 &&
                hasOwnProperty(container.allowed, path)
            ) {
                transformed.default = container.allowed[path];
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
                    } else if (container.defaultPath) {
                        destPath = container.defaultPath;
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
}
