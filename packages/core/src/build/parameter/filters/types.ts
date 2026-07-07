/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '../../../parameter';
import type {
    NestedKeys,
    ObjectLiteral,
    PrevIndex,
    TypeFromNestedKeyPath,
} from '../../../types';

/**
 * Operator-object notation: `$` + {@link FilterFieldOperator} enum value,
 * one key per operator. Compound keys ($and/$or) are reserved for the
 * planned mongo parser dialect and deliberately absent here — compound
 * trees are built with the condition helpers instead (`filters: or(...)`).
 */
export type FiltersBuildOperatorInput<V> = {
    $eq?: V | null,
    $ne?: V | null,

    $lt?: V,
    $lte?: V,
    $gt?: V,
    $gte?: V,

    $in?: (V | null)[],
    $nin?: (V | null)[],

    $startsWith?: string,
    $notStartsWith?: string,

    $endsWith?: string,
    $notEndsWith?: string,

    $contains?: string,
    $notContains?: string,

    $regex?: RegExp | string,

    $mod?: [number, number],
    $exists?: boolean,
};

/**
 * Value grammar for a single field — four equivalent notations, none
 * enforced: scalar (eq), bare array (in — `null` is a legal element),
 * operator object, or a raw RegExp (regex).
 */
export type FiltersBuildValueInput<V> = V | null |
    (V | null)[] |
    (V extends string ? RegExp : never) |
    FiltersBuildOperatorInput<V>;

export type FiltersBuildElemMatchInput<
    T extends ObjectLiteral = ObjectLiteral,
    DEPTH extends number = 5,
> = {
    $elemMatch: FiltersBuildInput<T, DEPTH> | ICondition,
};

type FiltersBuildKeyValueInput<
    V,
    DEPTH extends number,
> = V extends Array<infer ELEMENT> ?
    (
        ELEMENT extends Date ?
            FiltersBuildValueInput<ELEMENT> :
            ELEMENT extends Record<PropertyKey, any> ?
                FiltersBuildInput<ELEMENT, DEPTH> | FiltersBuildElemMatchInput<ELEMENT, DEPTH> :
                FiltersBuildValueInput<ELEMENT>
    ) :
    V extends Date ?
        FiltersBuildValueInput<V> :
        V extends Record<PropertyKey, any> ?
            FiltersBuildInput<V, DEPTH> :
            FiltersBuildValueInput<V>;

export type FiltersBuildInput<
    T extends ObjectLiteral = ObjectLiteral,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ? never :
    {
        [K in keyof T & string]?: FiltersBuildKeyValueInput<T[K], PrevIndex[DEPTH]>
    } & {
        [K in NestedKeys<T>]?: FiltersBuildValueInput<TypeFromNestedKeyPath<T, K>>
    };
