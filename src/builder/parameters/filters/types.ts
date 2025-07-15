/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterCompoundOperator } from '../../../schema';
import type {
    ArrayItem, IsArray, IsScalar, NestedKeys, PrevIndex, TypeFromNestedKeyPath,
} from '../../../types';
import type { FiltersBuilder } from './module';

export type FilterValuePrimitive = boolean | number | string | null | undefined;

export type FilterValueWithOperator<V> = V extends string | number ?
    V | `!${V}` | `!~${V}` | `~${V}` | `<${V}` | `<=${V}` | `>${V}` | `>=${V}` | null | '!null' :
    V extends boolean ?
        V | null | '!null' :
        never;

export type FilterValue<V> = V extends Array<infer Item> ?
    FilterValueWithOperator<Item> | Array<FilterValueWithOperator<Item>> :
    FilterValueWithOperator<V> | Array<FilterValueWithOperator<V>>;

export type FiltersBuildInputValue<
    T,
    DEPTH extends number = 10,
> = [DEPTH] extends [0] ? never :
    T extends IsArray<T> ?
        FiltersBuildInputValue<ArrayItem<T>, PrevIndex[DEPTH]> :
        T extends IsScalar<T> ?
            FilterValue<T> :
            T extends Date ?
                FilterValue<string | number> :
                never;

type FiltersBuildInputSubLevel<
    T,
    DEPTH extends number = 10,
> = [DEPTH] extends [0] ?
    never :
    T extends IsArray<T> ?
        FiltersBuildInputSubLevel<ArrayItem<T>, PrevIndex[DEPTH]> :
        T extends Record<PropertyKey, any> ?
            FiltersBuildInput<T, PrevIndex[DEPTH]> :
            FiltersBuildInputValue<T, PrevIndex[DEPTH]>;

export type FiltersBuildCompoundInput<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 10,
> = [DEPTH] extends [0] ?
    never :
    {
        operator: `${FilterCompoundOperator}`,
        value: FiltersBuildInput<T, PrevIndex[DEPTH]>[]
    };

export type FiltersBuildInput<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 10,
> = [DEPTH] extends [0] ?
    never :
    {
        [K in keyof T]?: FiltersBuildInputSubLevel<T[K], PrevIndex[DEPTH]>
    } & {
        [K in NestedKeys<T>]?: FiltersBuildInputValue<TypeFromNestedKeyPath<T, K>, PrevIndex[DEPTH]>
    } | FiltersBuildCompoundInput<T>;

export type FiltersBuilderArg<T> = T extends FiltersBuilder<infer U> ? U : never;
