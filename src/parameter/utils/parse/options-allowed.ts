/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { NestedKeys, NestedResourceKeys } from '../../../type';
import { flattenToKeyPathArray } from '../../../utils';
import { ParseAllowedKeys } from '../../type';

export function flattenParseOptionsAllowed<T>(
    input: ParseAllowedKeys<T>,
) : string[] {
    return flattenToKeyPathArray(input);
}

export function isPathCoveredByParseAllowed<T>(
    input: ParseAllowedKeys<T> |
    NestedKeys<T>[] |
    NestedResourceKeys<T>[],
    path: string | string[],
) : boolean {
    const paths = Array.isArray(path) ? path : [path];

    const items = flattenToKeyPathArray(input);
    for (let i = 0; i < items.length; i++) {
        if (paths.indexOf(items[i]) !== -1) {
            return true;
        }
    }

    return false;
}
