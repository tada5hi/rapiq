/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    NestedKeys, NestedResourceKeys, ObjectLiteral, SimpleKeys,
} from '../types';
import { toKeyPathArray } from './array';

export type OptionAllowed<T> = T extends ObjectLiteral ? SimpleKeys<T>[] : string[];

export function flattenParseAllowedOption<T>(
    input?: OptionAllowed<T>,
): string[] {
    if (typeof input === 'undefined') {
        return [];
    }

    return toKeyPathArray(input);
}

export function isPathCoveredByParseAllowedOption<T extends ObjectLiteral>(
    input: OptionAllowed<T> |
    NestedKeys<T>[] |
    NestedResourceKeys<T>[],
    path: string | string[],
): boolean {
    const paths = Array.isArray(path) ? path : [path];

    const items = toKeyPathArray(input);
    for (let i = 0; i < items.length; i++) {
        if (paths.indexOf(items[i]) !== -1) {
            return true;
        }
    }

    return false;
}
