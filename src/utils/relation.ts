/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';

import type { KeyDetails } from './type';

export function isPathAllowed(
    path: string,
    allowed?: string[],
) : boolean {
    if (typeof allowed === 'undefined') {
        return true;
    }

    return allowed.some(
        (include) => include === path,
    );
}

export function buildKeyWithPath(input: KeyDetails) : string;
export function buildKeyWithPath(key: string, path: string): string;
export function buildKeyWithPath(
    name: string | KeyDetails,
    path?: string,
) : string {
    let details : KeyDetails;
    if (isObject(name)) {
        details = name;
    } else {
        details = {
            name,
            path,
        };
    }

    return details.path || path ?
        `${details.path || path}.${details.name}` :
        details.name;
}
