/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { mergeArrays } from 'smob';
import { ObjectLiteral } from '../../type';
import { RelationsBuildInput } from './type';
import { flattenToKeyPathArray } from '../../utils';

export function buildQueryRelations<T extends ObjectLiteral = ObjectLiteral>(
    input?: RelationsBuildInput<T>,
) : string[] {
    if (typeof input === 'undefined') {
        return [];
    }

    return flattenToKeyPathArray(input);
}

export function mergeQueryRelations(
    target?: string[],
    source?: string[],
) : string[] {
    return mergeArrays(target || [], source || [], true);
}
