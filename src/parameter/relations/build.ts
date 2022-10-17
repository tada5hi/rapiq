/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { RelationsBuildInput } from './type';
import { flattenNestedObject, mergeDeep } from '../../utils';

export function buildQueryRelationsForMany<T>(
    input: RelationsBuildInput<T>[],
) : string[] {
    let data : RelationsBuildInput<T>;
    for (let i = 0; i < input.length; i++) {
        if (data) {
            data = mergeDeep(data, input[i]);
        } else {
            data = input[i];
        }
    }

    return buildQueryRelations(data);
}

export function buildQueryRelations<T>(data: RelationsBuildInput<T>): string[] {
    const properties: Record<string, boolean> = flattenNestedObject(data);
    const keys: string[] = Object.keys(properties);

    return Array.from(new Set(keys));
}
