/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Flatten, NestedKeys, OnlyScalar, TypeFromNestedKeyPath,
} from '../../../types';

export type FilterValuePrimitive = boolean | number | string | null | undefined;

export type FilterValueWithOperator<V> = V extends string | number ?
    V | `!${V}` | `!~${V}` | `~${V}` | `<${V}` | `<=${V}` | `>${V}` | `>=${V}` | null | '!null' :
    V extends boolean ?
        V | null | '!null' :
        never;

type FilterValue<V> = V extends Array<infer Item> ?
    FilterValueWithOperator<Item> | Array<FilterValueWithOperator<Item>> :
    FilterValueWithOperator<V> | Array<FilterValueWithOperator<V>>;

export type FiltersBuildInputValue<T> = T extends OnlyScalar<T> ?
    FilterValue<T> :
    T extends Date ?
        FilterValue<string | number> :
        never;

type FilterBuildInputSubLevel<T> = T extends Record<PropertyKey, any> ?
    FiltersBuildInput<T> :
    FiltersBuildInputValue<T>;

export type FiltersBuildInput<T extends Record<PropertyKey, any>> = {
    [K in keyof T]?: FilterBuildInputSubLevel<Flatten<T[K]>>
} & {
    [K in NestedKeys<T>]?: FiltersBuildInputValue<TypeFromNestedKeyPath<T, K>>
};
