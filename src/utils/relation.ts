/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';

import type { RelationsParseOutput } from '../parser';
import type { KeyDetails } from './type';

export function isPathAllowedByRelations(
    path?: string,
    includes?: RelationsParseOutput,
) : boolean {
    if (typeof path === 'undefined' || typeof includes === 'undefined') {
        return true;
    }

    return includes.some(
        (include) => include.key === path,
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
