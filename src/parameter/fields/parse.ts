/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { distinctArray, isObject } from 'smob';
import { DEFAULT_ID } from '../../constants';
import type { ObjectLiteral } from '../../type';
import {
    applyMapping, groupArrayByKeyPath, hasOwnProperty, isPathAllowedByRelations, merge,
} from '../../utils';
import { flattenParseAllowedOption } from '../utils';
import { FieldOperator } from './constants';
import { FieldsParseError } from './errors';
import type { FieldsInputTransformed, FieldsParseOptions, FieldsParseOutput } from './type';
import { isValidFieldName, parseFieldsInput } from './utils';

// --------------------------------------------------

function buildReverseRecord(
    record: Record<string, string>,
) : Record<string, string> {
    const keys = Object.keys(record);
    const output : Record<string, string> = {};

    for (let i = 0; i < keys.length; i++) {
        output[record[keys[i]]] = keys[i];
    }

    return output;
}

export function parseQueryFields<T extends ObjectLiteral = ObjectLiteral>(
    input: unknown,
    options?: FieldsParseOptions<T>,
) : FieldsParseOutput {
    options = options || {};

    const defaultDomainFields = groupArrayByKeyPath(
        flattenParseAllowedOption(options.default),
    );

    const allowedDomainFields = groupArrayByKeyPath(
        flattenParseAllowedOption(options.allowed),
    );

    const domainFields = merge(
        defaultDomainFields,
        allowedDomainFields,
    );

    let keys : string[] = Object.keys(domainFields);

    // If it is an empty array nothing is allowed
    if (
        (typeof options.default !== 'undefined' || typeof options.allowed !== 'undefined') &&
        keys.length === 0
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
    } else if (options.throwOnError) {
        throw FieldsParseError.inputInvalid();
    }

    options.mapping = options.mapping || {};
    const reverseMapping = buildReverseRecord(options.mapping);

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
            if (options.throwOnError) {
                throw FieldsParseError.keyPathInvalid(path);
            }

            continue;
        }

        let fields : string[] = [];

        if (hasOwnProperty(data, path)) {
            fields = parseFieldsInput(data[path]);
        } else if (
            hasOwnProperty(reverseMapping, path) &&
            hasOwnProperty(data, reverseMapping[path])
        ) {
            fields = parseFieldsInput(data[reverseMapping[path]]);
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

                fields[j] = applyMapping(fields[j], options.mapping, true);

                let isValid : boolean;
                if (hasOwnProperty(domainFields, path)) {
                    isValid = domainFields[path].indexOf(fields[j]) !== -1;
                } else {
                    isValid = isValidFieldName(fields[j]);
                }

                if (!isValid) {
                    if (options.throwOnError) {
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
            hasOwnProperty(defaultDomainFields, path)
        ) {
            transformed.default = defaultDomainFields[path];
        }

        if (
            transformed.included.length === 0 &&
            transformed.default.length === 0 &&
            hasOwnProperty(allowedDomainFields, path)
        ) {
            transformed.default = allowedDomainFields[path];
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
                } else if (options.defaultPath) {
                    destPath = options.defaultPath;
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
