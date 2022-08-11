/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty } from '../../utils';
import {
    FieldsInputTransformed, FieldsParseOptions, FieldsParseOutput,
} from './type';
import { DEFAULT_ALIAS_ID } from './constants';
import {
    buildFieldDomainRecords,
    getFieldNamedByAliasMapping,
    mergeFieldsDomainRecords,
    parseFieldsInput, removeFieldInputOperator,
    transformFieldsInput,
} from './utils';

// --------------------------------------------------

function isRelationIncluded(key: string, options: FieldsParseOptions) : boolean {
    // is not default domain && includes are defined?

    if (
        key !== DEFAULT_ALIAS_ID &&
        key !== options.defaultAlias &&
        typeof options.relations !== 'undefined'
    ) {
        let index = -1;

        for (let j = 0; j < options.relations.length; j++) {
            if (options.relations[j].value === key) {
                index = j;
                break;
            }
        }

        if (index === -1) {
            return false;
        }
    }

    return true;
}

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

    const defaultDomainFields = buildFieldDomainRecords(options.default);
    const domainFields = mergeFieldsDomainRecords(
        buildFieldDomainRecords(options.allowed),
        { ...defaultDomainFields },
    );
    let domainKeys : string[] = Object.keys(domainFields);

    // If it is an empty array nothing is allowed
    if (domainKeys.length === 0) {
        return [];
    }

    if (options.defaultAlias) {
        if (hasOwnProperty(defaultDomainFields, DEFAULT_ALIAS_ID)) {
            replaceRecordKey(defaultDomainFields, DEFAULT_ALIAS_ID, options.defaultAlias);
        }

        if (hasOwnProperty(domainFields, DEFAULT_ALIAS_ID)) {
            replaceRecordKey(domainFields, DEFAULT_ALIAS_ID, options.defaultAlias);
        }
    }

    domainKeys = Object.keys(domainFields);

    let defaultAlias : string;

    if (
        domainKeys.length === 1 &&
        !options.defaultAlias
    ) {
        // eslint-disable-next-line prefer-destructuring
        defaultAlias = domainKeys[0];
    } else {
        defaultAlias = options.defaultAlias || DEFAULT_ALIAS_ID;
    }

    options.defaultAlias = defaultAlias;

    const prototype: string = Object.prototype.toString.call(data);
    if (
        prototype !== '[object Object]' &&
        prototype !== '[object Array]' &&
        prototype !== '[object String]'
    ) {
        data = { [defaultAlias]: [] };
    }

    if (prototype === '[object String]') {
        data = { [defaultAlias]: data };
    }

    if (prototype === '[object Array]') {
        data = { [defaultAlias]: data };
    }

    options.aliasMapping ??= {};
    const reverseAliasMapping = buildReverseRecord(options.aliasMapping);

    const output : FieldsParseOutput = [];

    for (let i = 0; i < domainKeys.length; i++) {
        const domainKey = domainKeys[i];

        if (!isRelationIncluded(domainKey, options)) {
            continue;
        }

        let fields : string[] = [];

        if (
            hasOwnProperty(data, domainKey)
        ) {
            fields = parseFieldsInput(data[domainKey]);
        } else if (
            hasOwnProperty(reverseAliasMapping, domainKey)
        ) {
            if (hasOwnProperty(data, reverseAliasMapping[domainKey])) {
                fields = parseFieldsInput(data[reverseAliasMapping[domainKey]]);
            }
        }

        let transformed : FieldsInputTransformed = {
            default: [],
            included: [],
            excluded: [],
        };

        if (fields.length > 0) {
            for (let j = 0; j < fields.length; j++) {
                fields[j] = getFieldNamedByAliasMapping(
                    domainKey,
                    fields[j],
                    options.aliasMapping,
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
            transformed.default.length === 0
        ) {
            if (hasOwnProperty(defaultDomainFields, domainKey)) {
                transformed.default = defaultDomainFields[domainKey];
            }

            if (
                transformed.included.length === 0 &&
                transformed.default.length === 0 &&
                hasOwnProperty(domainFields, domainKey)
            ) {
                transformed.default = domainFields[domainKey];
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
                    ...(domainKey !== DEFAULT_ALIAS_ID ? { alias: domainKey } : {}),
                });
            }
        }
    }

    return output;
}
