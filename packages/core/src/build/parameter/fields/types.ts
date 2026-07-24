/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { FieldOperator } from '../../../schema';
import type {
    KeyWithOptionalPrefix,
    NestedKeys,
    ObjectLiteral,
    PrevIndex,
    SimpleKeys,
    SimpleResourceKeys,
} from '../../../types';

type FieldWithOperator<T extends string> = KeyWithOptionalPrefix<T, FieldOperator>;

// `SimpleResourceKeys` admits record/array-shaped keys — concrete-typed json
// columns (e.g. `{ k: string }[]`), which are single columns at the database
// level but which `SimpleKeys`/`NestedKeys` treat as recursable resources.
// Listing the bare key selects the whole column, mirroring `defineSchema`
// `fields` (FieldKeys). Relation keys are admitted too (structurally identical
// at the type level) — list only column-backed keys; relations use `include`.
export type FieldsBuildSimpleKeyInput<
    T extends ObjectLiteral = ObjectLiteral,
> = FieldWithOperator<SimpleKeys<T> | SimpleResourceKeys<T>>;

export type FieldsBuildNestedKeyInput<
    T extends ObjectLiteral = ObjectLiteral,
    DEPTH extends number = 5,
> = FieldWithOperator<NestedKeys<T, DEPTH> | SimpleResourceKeys<T>>;

export type FieldsBuildRecordInput<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ? never : {
    [K in keyof T & string]?: T[K] extends Array<infer ELEMENT> ?
        (ELEMENT extends Record<PropertyKey, any> ?
            FieldsBuildInput<ELEMENT, PrevIndex[DEPTH]> :
            never
        ) :
        T[K] extends Record<PropertyKey, any> ?
            FieldsBuildInput<T[K], PrevIndex[DEPTH]> :
            never
};

export type FieldsBuildTupleInput<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ? never : [
    FieldsBuildSimpleKeyInput<T>[],
    FieldsBuildRecordInput<T, PrevIndex[DEPTH]>,
];

export type FieldsBuildInput<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ? never :
    FieldsBuildRecordInput<T, PrevIndex[DEPTH]> |
    FieldsBuildTupleInput<T, PrevIndex[DEPTH]> |
    FieldsBuildNestedKeyInput<T, DEPTH>[] |
    FieldsBuildNestedKeyInput<T, DEPTH>;
