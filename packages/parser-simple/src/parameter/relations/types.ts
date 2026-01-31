/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { NestedResourceKeys, PrevIndex } from '@rapiq/core';

export type RelationsBuildInput<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ?
    never : {
        [K in keyof T & string]?: T[K] extends Array<infer ELEMENT> ?
            (
                ELEMENT extends Record<PropertyKey, any> ?
                    RelationsBuildInput<ELEMENT, PrevIndex[DEPTH]> | boolean :
                    never
            ) :
            T[K] extends Record<PropertyKey, any> ?
                RelationsBuildInput<T[K], PrevIndex[DEPTH]> | boolean :
                never
    } |
    NestedResourceKeys<T>[] |
    NestedResourceKeys<T>;
