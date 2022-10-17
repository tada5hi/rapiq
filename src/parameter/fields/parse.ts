/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { merge } from 'smob';
import {
    applyMapping, buildFieldWithPath, groupArrayByKeyPath, hasOwnProperty, isFieldPathAllowedByRelations,
} from '../../utils';
import { flattenParseOptionsAllowed } from '../utils';
import {
    FieldsInputTransformed, FieldsParseOptions, FieldsParseOutput,
} from './type';
import {
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

export function replaceRecordKey(record: Record<string, any>, key: string, newKey: string) : Record<string, any> {
    if (
        hasOwnProperty(record, key)
    ) {
        const value = record[key];
        delete record[key];
        record[newKey] = value;
    }

    return record;
}

export function parseQueryFields(
    data: unknown,
    options?: FieldsParseOptions,
) : FieldsParseOutput {
    options ??= {};

    const defaultDomainFields = groupArrayByKeyPath(
        flattenParseOptionsAllowed(options.default),
    );

    const allowedDomainFields = groupArrayByKeyPath(
        flattenParseOptionsAllowed(options.allowed),
    );

    const domainFields = merge(
        {},
        defaultDomainFields,
        allowedDomainFields,
    );

    let domainKeys : string[] = Object.keys(domainFields);

    // If it is an empty array nothing is allowed
    if (domainKeys.length === 0) {
        return [];
    }

    domainKeys = Object.keys(domainFields);

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

    options.mapping ??= {};
    const reverseMapping = buildReverseRecord(options.mapping);

    const output : FieldsParseOutput = [];

    for (let i = 0; i < domainKeys.length; i++) {
        const domainKey = domainKeys[i];

        if (
            !isFieldPathAllowedByRelations({ path: domainKey }, options.relations) &&
            domainKey !== DEFAULT_ID
        ) {
            continue;
        }

        let fields : string[] = [];

        if (
            hasOwnProperty(data, domainKey)
        ) {
            fields = parseFieldsInput(data[domainKey]);
        } else if (
            hasOwnProperty(reverseMapping, domainKey)
        ) {
            if (hasOwnProperty(data, reverseMapping[domainKey])) {
                fields = parseFieldsInput(data[reverseMapping[domainKey]]);
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
                    buildFieldWithPath({ name: fields[j], path: domainKey }),
                    options.mapping,
                    true,
                );
            }

            fields = fields
                .filter((field) => domainFields[domainKey].indexOf(
                    removeFieldInputOperator(field),
                ) !== -1);

            transformed = transformFieldsInput(
                fields,
            );
        }

        if (
            transformed.default.length === 0 &&
            hasOwnProperty(defaultDomainFields, domainKey)
        ) {
            transformed.default = defaultDomainFields[domainKey];
        }

        if (
            transformed.included.length === 0 &&
            transformed.default.length === 0 &&
            hasOwnProperty(allowedDomainFields, domainKey)
        ) {
            transformed.default = allowedDomainFields[domainKey];
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
                    ...(domainKey !== DEFAULT_ID ? { path: domainKey } : {}),
                });
            }
        }
    }

    return output;
}
