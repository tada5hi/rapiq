/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty } from '../../utils';
import {
    DEFAULT_ALIAS_ID, FieldOperator, FieldsParseOptions, FieldsParseOutput, FieldsParseOutputElement,
} from './type';

// --------------------------------------------------

// --------------------------------------------------

export function buildDomainFields(
    data: Record<string, string[]> | string[],
    options?: FieldsParseOptions,
) {
    options = options ?? { defaultAlias: DEFAULT_ALIAS_ID };

    let domainFields : Record<string, string[]> = {};

    if (Array.isArray(data)) {
        domainFields[options.defaultAlias] = data;
    } else {
        domainFields = data;
    }

    return domainFields;
}

export function parseQueryFields(
    data: unknown,
    options?: FieldsParseOptions,
) : FieldsParseOutput {
    options ??= {};

    // If it is an empty array nothing is allowed
    if (
        typeof options.allowed !== 'undefined' &&
        Object.keys(options.allowed).length === 0
    ) {
        return [];
    }

    options.aliasMapping ??= {};
    options.relations ??= [];
    options.defaultAlias ??= DEFAULT_ALIAS_ID;

    let allowedDomainFields : Record<string, string[]> | undefined;
    if (options.allowed) {
        allowedDomainFields = buildDomainFields(options.allowed, options);
    }

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

    const keys = Object.keys(data);

    for (let i = 0; i < keys.length; i++) {
        if (
            !hasOwnProperty(data, keys[i]) ||
            typeof keys[i] !== 'string'
        ) {
            continue;
        }

        const fieldsArr : string[] = buildArrayFieldsRepresentation(data[keys[i]]);
        if (fieldsArr.length === 0) {
            continue;
        }

        let fields : FieldsParseOutputElement[] = [];

        for (let j = 0; j < fieldsArr.length; j++) {
            let operator: FieldOperator | undefined;

            switch (true) {
                case fieldsArr[j].substring(0, 1) === FieldOperator.INCLUDE:
                    operator = FieldOperator.INCLUDE;
                    break;
                case fieldsArr[j].substring(0, 1) === FieldOperator.EXCLUDE:
                    operator = FieldOperator.EXCLUDE;
                    break;
            }

            if (operator) fieldsArr[j] = fieldsArr[j].substring(1);

            fields.push({
                key: fieldsArr[j],
                ...(operator ? { value: operator } : {}),
            });
        }

        const allowedDomains : string[] = typeof allowedDomainFields !== 'undefined' ?
            Object.keys(allowedDomainFields) :
            [];

        const targetKey : string = allowedDomains.length === 1 ?
            allowedDomains[0] :
            keys[i];

        // is not default domain && includes are defined?
        if (
            keys[i] !== DEFAULT_ALIAS_ID &&
            keys[i] !== options.defaultAlias &&
            typeof options.relations !== 'undefined'
        ) {
            let index = -1;

            for (let j = 0; j < options.relations.length; j++) {
                if (options.relations[j].value === keys[i]) {
                    index = j;
                    break;
                }
            }

            if (index === -1) {
                continue;
            }
        }

        for (let j = 0; j < fields.length; j++) {
            const fullKey = `${keys[i]}.${fields[j].key}`;

            fields[j] = {
                ...(targetKey && targetKey !== DEFAULT_ALIAS_ID ? { alias: targetKey } : {}),
                ...fields[j],
                key: hasOwnProperty(options.aliasMapping, fullKey) ?
                    options.aliasMapping[fullKey].split('.').pop() :
                    fields[j].key,
            };
        }

        fields = fields
            .filter((field) => {
                if (typeof allowedDomainFields === 'undefined') {
                    return true;
                }

                return hasOwnProperty(allowedDomainFields, targetKey) &&
                    allowedDomainFields[targetKey].indexOf(field.key) !== -1;
            });

        if (fields.length > 0) {
            transformed = [...transformed, ...fields];
        }
    }

    return transformed;
}

function buildArrayFieldsRepresentation(data: unknown) : string[] {
    const valuePrototype : string = Object.prototype.toString.call(data);
    if (
        valuePrototype !== '[object Array]' &&
        valuePrototype !== '[object String]'
    ) {
        return [];
    }

    let fieldsArr : string[] = [];

    /* istanbul ignore next */
    if (valuePrototype === '[object String]') {
        fieldsArr = (data as string).split(',');
    }

    /* istanbul ignore next */
    if (valuePrototype === '[object Array]') {
        fieldsArr = (data as unknown[])
            .filter((val) => typeof val === 'string') as string[];
    }

    return fieldsArr;
}
