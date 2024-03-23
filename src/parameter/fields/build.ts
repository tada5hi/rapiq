/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../type';
import type { FieldsBuildInput } from './type';
import { groupArrayByKeyPath, merge, toKeyPathArray } from '../../utils';

export function buildQueryFields<T extends ObjectLiteral = ObjectLiteral>(
    input?: FieldsBuildInput<T>,
) : Record<string, string[]> | string[] {
    if (typeof input === 'undefined') {
        return [];
    }

    const data = groupArrayByKeyPath(toKeyPathArray(input));

    const keys = Object.keys(data);
    if (keys.length === 1) {
        return data[keys[0]];
    }

    return data;
}

export function mergeQueryFields(
    target: Record<string, string[]> | string[],
    source: Record<string, string[]> | string[],
): Record<string, string[]> | string[] {
    if (Array.isArray(target)) {
        target = groupArrayByKeyPath(target);
    }

    if (Array.isArray(source)) {
        source = groupArrayByKeyPath(source);
    }

    const data = merge(target, source);

    const keys = Object.keys(data);
    if (keys.length === 1) {
        return data[keys[0]];
    }

    return data;
}
