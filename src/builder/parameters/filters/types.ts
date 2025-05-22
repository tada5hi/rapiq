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
export type FilterValueSimple<T> = T extends any[] ? T[number] : T;

export type FilterValueWithOperator<V> = V extends string | number ?
    V | `!${V}` | `!~${V}` | `~${V}` | `<${V}` | `<=${V}` | `>${V}` | `>=${V}` | null | '!null' :
    V extends boolean ? V | null | '!null' : never;

export type FilterValue<V> = V extends FilterValuePrimitive ?
    (FilterValueSimple<V> | FilterValueWithOperator<V> | Array<FilterValueWithOperator<V>>) :
    V;

export type FiltersBuildInputValue<T> = T extends OnlyScalar<T> ? T | FilterValue<T> : never;

export type FiltersBuildInput<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends Record<string, any> ?
        FiltersBuildInput<Flatten<T[K]>> :
        FiltersBuildInputValue<Flatten<T[K]>>
} & {
    [K in NestedKeys<T>]?: FiltersBuildInputValue<TypeFromNestedKeyPath<T, K>>
};
