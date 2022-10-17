/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty } from '../../../utils';
import { DEFAULT_ID } from '../../../constants';

export function buildFieldDomainRecords(
    data?: Record<string, string[]> | string[],
): Record<string, string[]> {
    if (typeof data === 'undefined') {
        return {};
    }

    let domainFields: Record<string, string[]> = {};

    if (Array.isArray(data)) {
        domainFields[DEFAULT_ID] = data;
    } else {
        domainFields = data;
    }

    return domainFields;
}

export function mergeFieldsDomainRecords(
    sourceA: Record<string, string[]>,
    sourceB: Record<string, string[]>,
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

    if (
        keys.length >= 2 &&
        hasOwnProperty(target, DEFAULT_ID) &&
        Array.isArray(target[DEFAULT_ID]) &&
        target[DEFAULT_ID].length === 0
    ) {
        delete target[DEFAULT_ID];
    }

    return target;
}
