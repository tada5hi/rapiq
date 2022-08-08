/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ALIAS_ID } from '../constants';
import { hasOwnProperty } from '../../../utils';

export function buildFieldDomainRecords(
    data?: Record<string, string[]> | string[],
    defaultAlias?: string,
): Record<string, string[]> {
    if (typeof data === 'undefined') {
        return {};
    }

    let domainFields: Record<string, string[]> = {};

    if (Array.isArray(data)) {
        domainFields[defaultAlias || DEFAULT_ALIAS_ID] = data;
    } else {
        domainFields = data;
    }

    return domainFields;
}

export function mergeFieldsDomainRecords(
    sourceA: Record<string, string[]>,
    sourceB: Record<string, string[]>,
    defaultAlias?: string,
) {
    const target: Record<string, string[]> = {};

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

    const alias = defaultAlias || DEFAULT_ALIAS_ID;

    if (
        keys.length >= 2 &&
        hasOwnProperty(target, alias) &&
        target[alias].length === 0
    ) {
        delete target[alias];
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
