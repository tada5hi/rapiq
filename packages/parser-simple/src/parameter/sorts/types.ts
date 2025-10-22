/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    KeyWithOptionalPrefix, NestedKeys, PrevIndex, SimpleKeys, SortDirection,
} from 'rapiq';

type SortWithOperator<T extends string> = KeyWithOptionalPrefix<T, '-'>;
type SortBuildRecordInput<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ? never : {
    [K in keyof T & string]?: T[K] extends Array<infer ELEMENT> ?
        (
            ELEMENT extends Record<PropertyKey, any> ?
                SortBuildInput<ELEMENT, PrevIndex[DEPTH]> :
                `${SortDirection}`
        ) :
        T[K] extends Record<PropertyKey, any> ?
            SortBuildInput<T[K], PrevIndex[DEPTH]> :
            `${SortDirection}`
};

export type SortBuildInput<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ? never :
    SortBuildRecordInput<T, PrevIndex[DEPTH]> |
    [
        SortWithOperator<SimpleKeys<T>>[],
        SortBuildRecordInput<T, PrevIndex[DEPTH]>,
    ]
    |
    SortWithOperator<NestedKeys<T>>[] |
    SortWithOperator<NestedKeys<T>>;
