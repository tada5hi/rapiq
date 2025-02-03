/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../type';
import type { RelationsBuildInput } from './type';
import { merge, toKeyPathArray } from '../../utils';

export function buildQueryRelations<T extends ObjectLiteral = ObjectLiteral>(
    input?: RelationsBuildInput<T>,
) : string[] {
    if (typeof input === 'undefined') {
        return [];
    }

    return toKeyPathArray(input);
}

export function mergeQueryRelations(
    target?: string[],
    source?: string[],
) : string[] {
    return merge(target || [], source || []);
}
