/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { merge } from 'smob';
import { ObjectLiteral } from '../../type';
import {
    applyMapping, buildFieldWithPath, groupArrayByKeyPath, hasOwnProperty, isFieldPathAllowedByRelations,
} from '../../utils';
import { flattenParseAllowedOption } from '../utils';
import {
    FieldsInputTransformed, FieldsParseOptions, FieldsParseOutput,
} from './type';
import {
    isValidFieldName,
    parseFieldsInput, removeFieldInputOperator,
    transformFieldsInput,
} from './utils';
import { DEFAULT_ID } from '../../constants';

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
    data: unknown,
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
        {},
        defaultDomainFields,
        allowedDomainFields,
    );

    let keys : string[] = Object.keys(domainFields);

    // If it is an empty array nothing is allowed
    if (
        (
            typeof options.default !== 'undefined' ||
            typeof options.allowed !== 'undefined'
        ) && keys.length === 0
    ) {
        return [];
    }

    const prototype: string = Object.prototype.toString.call(data);
    if (
        prototype !== '[object Object]' &&
        prototype !== '[object Array]' &&
        prototype !== '[object String]'
    ) {
        data = { [DEFAULT_ID]: [] };
    }

    if (prototype === '[object String]') {
        data = { [DEFAULT_ID]: data };
    }

    if (prototype === '[object Array]') {
        data = { [DEFAULT_ID]: data };
    }

    options.mapping = options.mapping || {};
    const reverseMapping = buildReverseRecord(options.mapping);

    if (keys.length === 0) {
        keys = Object.keys(data);
    }

    const output : FieldsParseOutput = [];

    for (let i = 0; i < keys.length; i++) {
        const path = keys[i];

        if (
            !isFieldPathAllowedByRelations({ path }, options.relations) &&
            path !== DEFAULT_ID
        ) {
            continue;
        }

        let fields : string[] = [];

        if (
            hasOwnProperty(data, path)
        ) {
            fields = parseFieldsInput(data[path]);
        } else if (
            hasOwnProperty(reverseMapping, path)
        ) {
            if (hasOwnProperty(data, reverseMapping[path])) {
                fields = parseFieldsInput(data[reverseMapping[path]]);
            }
        }

        let transformed : FieldsInputTransformed = {
            default: [],
            included: [],
            excluded: [],
        };

        if (fields.length > 0) {
            for (let j = 0; j < fields.length; j++) {
                fields[j] = applyMapping(
                    buildFieldWithPath({ name: fields[j], path }),
                    options.mapping,
                    true,
                );
            }

            if (hasOwnProperty(domainFields, path)) {
                fields = fields.filter((field) => domainFields[path].indexOf(
                    removeFieldInputOperator(field),
                ) !== -1);
            } else {
                fields = fields.filter((field) => isValidFieldName(removeFieldInputOperator(field)));
            }

            transformed = transformFieldsInput(
                fields,
            );
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
