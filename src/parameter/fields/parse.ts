/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty } from '../../utils';
import { FieldsParseOptions, FieldsParseOutput, FieldsParseOutputElement } from './type';
import { DEFAULT_ALIAS_ID, FieldOperator } from './constants';
import {
    buildFieldDomainRecords,
    getFieldNamedByAliasMapping,
    mergeFieldsDomainRecords,
    parseFieldsInput,
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

export function parseQueryFields(
    data: unknown,
    options?: FieldsParseOptions,
) : FieldsParseOutput {
    options ??= {};
    options.defaultAlias ??= DEFAULT_ALIAS_ID;

    const defaultDomainFields = buildFieldDomainRecords(options.default);
    const defaultDomainKeys = Object.keys(defaultDomainFields);

    const allowedDomainFields = mergeFieldsDomainRecords(
        buildFieldDomainRecords(options.allowed),
        { ...defaultDomainFields },
        options,
    );
    const allowedDomainKeys : string[] = Object.keys(allowedDomainFields);

    // If it is an empty array nothing is allowed
    if (allowedDomainKeys.length === 0) {
        return [];
    }

    options.aliasMapping ??= {};

    const prototype: string = Object.prototype.toString.call(data);
    if (
        prototype !== '[object Object]' &&
        prototype !== '[object Array]' &&
        prototype !== '[object String]'
    ) {
        return [];
    }

    if (prototype === '[object String]') {
        data = { [options.defaultAlias]: data };
    }

    if (prototype === '[object Array]') {
        data = { [options.defaultAlias]: data };
    }

    let transformed : FieldsParseOutput = [];

    const domainKeys = Object.keys(data);
    const processedDomainKeys : string[] = [];
    for (let i = 0; i < domainKeys.length; i++) {
        if (
            !hasOwnProperty(data, domainKeys[i]) ||
            typeof domainKeys[i] !== 'string'
        ) {
            continue;
        }

        let domainKey = domainKeys[i];
        let output : FieldsParseOutputElement[] = [];

        const fields = parseFieldsInput(data[domainKey]);

        domainKey = hasOwnProperty(options.aliasMapping, domainKeys[i]) ?
            options.aliasMapping[domainKeys[i]] :
            domainKey;

        if (!isRelationIncluded(domainKey, options)) {
            continue;
        }

        domainKey = allowedDomainKeys.length === 1 ?
            allowedDomainKeys[0] :
            domainKey;

        if (
            fields.length === 0 &&
            !hasOwnProperty(defaultDomainFields, domainKey)
        ) {
            continue;
        }

        if (fields.length > 0) {
            const fieldsInputTransformed = transformFieldsInput(fields);

            if (
                fieldsInputTransformed.default.length === 0 &&
                hasOwnProperty(defaultDomainFields, domainKey)
            ) {
                fieldsInputTransformed.default = defaultDomainFields[domainKey];
            }

            if (fieldsInputTransformed.default.length > 0) {
                fieldsInputTransformed.default = Array.from(new Set([...fieldsInputTransformed.default, ...fieldsInputTransformed.included]));
                for (let j = 0; j < fieldsInputTransformed.excluded.length; j++) {
                    const index = fieldsInputTransformed.default.indexOf(fieldsInputTransformed.excluded[j]);
                    if (index !== -1) {
                        fieldsInputTransformed.default.splice(index, 1);
                    }
                }

                fieldsInputTransformed.included = [];
                fieldsInputTransformed.excluded = [];
            }

            if (fieldsInputTransformed.default.length > 0) {
                for (let j = 0; j < fieldsInputTransformed.default.length; j++) {
                    output.push({
                        key: fieldsInputTransformed.default[j],
                    });
                }
            }

            if (fieldsInputTransformed.included.length > 0) {
                for (let j = 0; j < fieldsInputTransformed.included.length; j++) {
                    output.push({
                        key: fieldsInputTransformed.included[j],
                        value: FieldOperator.INCLUDE,
                    });
                }
            }

            if (fieldsInputTransformed.excluded.length > 0) {
                for (let j = 0; j < fieldsInputTransformed.excluded.length; j++) {
                    output.push({
                        key: fieldsInputTransformed.excluded[j],
                        value: FieldOperator.EXCLUDE,
                    });
                }
            }
        } else if (defaultDomainFields[domainKey].length > 0) {
            for (let j = 0; j < defaultDomainFields[domainKey].length; j++) {
                output.push({
                    key: defaultDomainFields[domainKey][j],
                });
            }
        }

        for (let j = 0; j < output.length; j++) {
            output[j].key = getFieldNamedByAliasMapping(
                domainKey,
                output[j].key,
                options.aliasMapping,
            );

            if (domainKey !== options.defaultAlias) {
                output[j].alias = domainKey;
            }
        }

        if (
            typeof options.allowed !== 'undefined' ||
            typeof options.default !== 'undefined'
        ) {
            output = output
                .filter((field) => hasOwnProperty(allowedDomainFields, domainKey) &&
                        allowedDomainFields[domainKey].indexOf(field.key) !== -1);
        }

        if (output.length > 0) {
            processedDomainKeys.push(domainKey);
            transformed = [...transformed, ...output];
        }
    }

    if (defaultDomainKeys.length > 0) {
        const missingDomainKeys: string[] = [];

        for (let i = 0; i < defaultDomainKeys.length; i++) {
            if (
                processedDomainKeys.indexOf(defaultDomainKeys[i]) === -1 &&
                isRelationIncluded(defaultDomainKeys[i], options)
            ) {
                missingDomainKeys.push(defaultDomainKeys[i]);
            }
        }

        if (missingDomainKeys.length > 0) {
            for (let i = 0; i < missingDomainKeys.length; i++) {
                for (let j = 0; j < defaultDomainFields[missingDomainKeys[i]].length; j++) {
                    transformed.push({
                        ...(missingDomainKeys[i] !== options.defaultAlias ? { alias: missingDomainKeys[i] } : {}),
                        key: getFieldNamedByAliasMapping(
                            missingDomainKeys[i],
                            defaultDomainFields[missingDomainKeys[i]][j],
                            options.aliasMapping,
                        ),
                    });
                }
            }
        }
    }

    return transformed;
}
