/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { NestedKeys, NestedResourceKeys, ObjectLiteral } from '../../../type';
import { flattenToKeyPathArray } from '../../../utils';
import { ParseAllowedOption } from '../../type';

export function flattenParseAllowedOption<T extends ObjectLiteral>(
    input?: ParseAllowedOption<T>,
) : string[] {
    if (typeof input === 'undefined') {
        return [];
    }

    return flattenToKeyPathArray(input);
}

export function isPathCoveredByParseAllowedOption<T extends ObjectLiteral>(
    input: ParseAllowedOption<T> |
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
