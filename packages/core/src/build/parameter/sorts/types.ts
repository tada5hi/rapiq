/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { SortDirection } from '../../../schema';
import type {
    KeyWithOptionalPrefix,
    NestedKeys,
    ObjectLiteral,
    PrevIndex,
    SimpleKeys,
} from '../../../types';

type SortWithOperator<T extends string> = KeyWithOptionalPrefix<T, '-'>;

export type SortsBuildRecordInput<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ? never : {
    [K in keyof T & string]?: T[K] extends Array<infer ELEMENT> ?
        (
            ELEMENT extends Record<PropertyKey, any> ?
                SortsBuildInput<ELEMENT, PrevIndex[DEPTH]> :
                `${SortDirection}`
        ) :
        T[K] extends Record<PropertyKey, any> ?
            SortsBuildInput<T[K], PrevIndex[DEPTH]> :
            `${SortDirection}`
};

export type SortsBuildInput<
    T extends ObjectLiteral = ObjectLiteral,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ? never :
    SortsBuildRecordInput<T, PrevIndex[DEPTH]> |
    [
        SortWithOperator<SimpleKeys<T>>[],
        SortsBuildRecordInput<T, PrevIndex[DEPTH]>,
    ] |
    SortWithOperator<NestedKeys<T>>[] |
    SortWithOperator<NestedKeys<T>>;
