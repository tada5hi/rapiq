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
    $size?: number,
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

/**
 * Array-level operators of an object-array field — element matching
 * and the array-length check (scalar arrays reach both through the
 * plain operator object).
 */
export type FiltersBuildElemMatchInput<
    T extends ObjectLiteral = ObjectLiteral,
    DEPTH extends number = 5,
> = {
    $elemMatch?: FiltersBuildInput<T, DEPTH> | ICondition,
    $size?: number,
};

/**
 * Value grammar for a single key of the nested-object arm. Record-valued
 * keys recurse into {@link FiltersBuildNestedInput} — the nested-object
 * form only — rather than the full {@link FiltersBuildInput}. Recursing
 * into the full input would re-enumerate the child's dotted relation paths
 * at every nesting level, but the flat arm of {@link FiltersBuildInput}
 * already lists each of those paths once; the repetition is pure redundancy
 * that grows the inferred type super-linearly and, for deeply/cyclically
 * related records, overflows declaration-emit serialization (#821). The
 * `$elemMatch` interior deliberately keeps the full input — it opens a
 * fresh filter scope over the element type.
 */
type FiltersBuildNestedKeyValueInput<
    V,
    DEPTH extends number,
> = V extends Array<infer ELEMENT> ?
    (
        ELEMENT extends Date ?
            FiltersBuildValueInput<ELEMENT> :
            ELEMENT extends Record<PropertyKey, any> ?
                FiltersBuildNestedInput<ELEMENT, DEPTH> | FiltersBuildElemMatchInput<ELEMENT, DEPTH> :
                FiltersBuildValueInput<ELEMENT>
    ) :
    V extends Date ?
        FiltersBuildValueInput<V> :
        V extends Record<PropertyKey, any> ?
            FiltersBuildNestedInput<V, DEPTH> :
            FiltersBuildValueInput<V>;

/**
 * The nested-object arm: every declared key of `T`, with record-valued keys
 * recursing into the nested form only (dotted relation paths are the flat
 * arm's job, see {@link FiltersBuildInput}). DEPTH bounds the recursion the
 * same way the flat arm does.
 */
type FiltersBuildNestedInput<
    T extends ObjectLiteral = ObjectLiteral,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ? never :
    {
        [K in keyof T & string]?: FiltersBuildNestedKeyValueInput<T[K], PrevIndex[DEPTH]>
    };

/**
 * Filter input for a record — two complementary arms, intersected:
 *
 *  - the nested-object arm ({@link FiltersBuildNestedInput}) —
 *    `{ realm: { name: 'x' } }`;
 *  - the flat dotted-key arm — `{ 'realm.name': 'x' }`, every relation path
 *    reachable within DEPTH.
 *
 * The arms are kept disjoint: the nested arm does not re-enumerate its
 * children's dotted paths (the flat arm already does, once). The only shape
 * this drops versus a naive full recursion is the redundant mixed form
 * `{ realm: { 'x.y': v } }` — write `{ 'realm.x.y': v }` (flat) or
 * `{ realm: { x: { y: v } } }` (nested) instead. That disjointness is what
 * keeps the inferred type serializable for deeply/cyclically related
 * records (#821); the runtime still accepts the mixed form.
 */
export type FiltersBuildInput<
    T extends ObjectLiteral = ObjectLiteral,
    DEPTH extends number = 5,
> = [DEPTH] extends [0] ? never :
    FiltersBuildNestedInput<T, DEPTH> & {
        [K in NestedKeys<T, DEPTH>]?: FiltersBuildValueInput<TypeFromNestedKeyPath<T, K, DEPTH>>
    };
