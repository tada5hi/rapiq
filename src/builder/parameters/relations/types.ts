/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { NestedResourceKeys } from '../../../types';

export type RelationsBuildInput<T extends Record<PropertyKey, any>> = {
    [K in keyof T]?: T[K] extends Array<infer ELEMENT> ?
        (
            ELEMENT extends Record<PropertyKey, any> ?
                RelationsBuildInput<ELEMENT> | boolean :
                never
        ) :
        T[K] extends Record<PropertyKey, any> ?
            RelationsBuildInput<T[K]> | boolean :
            never
} |
NestedResourceKeys<T>[] |
NestedResourceKeys<T>;
