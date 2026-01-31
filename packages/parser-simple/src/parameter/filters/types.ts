/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ArrayItem, IsArray, IsScalar, NestedKeys, PrevIndex, TypeFromNestedKeyPath,
} from '@rapiq/core';

type ValueWithOperator<V> = V extends string | number ?
    V | `!${V}` | `!~${V}` | `~${V}` | `<${V}` | `<=${V}` | `>${V}` | `>=${V}` | null | '!null' :
    V extends boolean ?
        V | null | '!null' :
        never;

type Value<V> = V extends Array<infer Item> ?
    ValueWithOperator<Item> | Array<ValueWithOperator<Item>> :
    ValueWithOperator<V> | Array<ValueWithOperator<V>>;

export type SimpleFiltersParserInputValue<
    T,
    DEPTH extends number = 10,
> = [DEPTH] extends [0] ? never :
    T extends Array<infer ELEMENT> ?
        SimpleFiltersParserInputValue<ELEMENT, PrevIndex[DEPTH]> :
        T extends IsScalar<T> ?
            Value<T> :
            T extends Date ?
                Value<string | number> :
                never;

type SimpleFiltersParserInputSubLevel<
    T,
    DEPTH extends number = 10,
> = [DEPTH] extends [0] ?
    never :
    T extends IsArray<T> ?
        SimpleFiltersParserInputSubLevel<ArrayItem<T>, PrevIndex[DEPTH]> :
        T extends Record<PropertyKey, any> ?
            SimpleFiltersParserInput<T, PrevIndex[DEPTH]> :
            SimpleFiltersParserInputValue<T, PrevIndex[DEPTH]>;

export type SimpleFiltersParserInput<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 10,
> = [DEPTH] extends [0] ?
    never :
    {
        [K in keyof T]?: SimpleFiltersParserInputSubLevel<T[K], PrevIndex[DEPTH]>
    } & {
        [K in NestedKeys<T>]?: SimpleFiltersParserInputValue<TypeFromNestedKeyPath<T, K>, PrevIndex[DEPTH]>
    };
