/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldsParseOptions } from '../type';
import { DEFAULT_ALIAS_ID } from '../constants';
import { hasOwnProperty } from '../../../utils';

export function buildFieldDomainRecords(
    data?: Record<string, string[]> | string[],
    options?: FieldsParseOptions,
): Record<string, string[]> {
    if (typeof data === 'undefined') {
        return {};
    }

    options = options ?? { defaultAlias: DEFAULT_ALIAS_ID };

    let domainFields: Record<string, string[]> = {};

    if (Array.isArray(data)) {
        domainFields[options.defaultAlias] = data;
    } else {
        domainFields = data;
    }

    return domainFields;
}

export function mergeFieldsDomainRecords(
    sourceA: Record<string, string[]>,
    sourceB: Record<string, string[]>,
    options?: FieldsParseOptions,
) {
    const target: Record<string, string[]> = {};
    options = options ?? { defaultAlias: DEFAULT_ALIAS_ID };

    let keys = Object.keys(sourceA);
    for (let i = 0; i < keys.length; i++) {
        if (hasOwnProperty(sourceB, keys[i])) {
            target[keys[i]] = [...sourceA[keys[i]], ...sourceB[keys[i]]];
        } else {
            target[keys[i]] = [...sourceA[keys[i]]];
        }
    }

    keys = Object.keys(sourceB).filter((key) => !keys.includes(key));
    for (let i = 0; i < keys.length; i++) {
        if (hasOwnProperty(sourceA, keys[i])) {
            target[keys[i]] = [...sourceA[keys[i]], ...sourceB[keys[i]]];
        } else {
            target[keys[i]] = [...sourceB[keys[i]]];
        }
    }

    keys = Object.keys(target);
    if (
        keys.length >= 2 &&
        hasOwnProperty(target, options.defaultAlias) &&
        target[options.defaultAlias].length === 0
    ) {
        delete target[options.defaultAlias];
    }

    return target;
}

export function getFieldNamedByAliasMapping(
    domain: string,
    field: string,
    aliasMapping?: Record<string, string>,
) {
    if (typeof aliasMapping === 'undefined') {
        return field;
    }

    const key = `${domain}.${field}`;
    return hasOwnProperty(aliasMapping, key) ?
        aliasMapping[key].split('.').pop() :
        field;
}
