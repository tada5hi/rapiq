/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Flatten,
    NestedKeys, ObjectLiteral, OnlyObject, OnlyScalar, TypeFromNestedKeyPath,
} from '../../type';
import { RelationsParseOutput } from '../relations';
import {
    ParseAllowedKeys,
} from '../type';
import { FilterOperator, FilterOperatorLabel } from './constants';

// -----------------------------------------------------------

type FilterValueInputPrimitive = boolean | number | string;
type FilterValueInput = FilterValueInputPrimitive | null | undefined;

export type FilterValueSimple<V extends FilterValueInput = FilterValueInput> = V extends string | number ? (V | V[]) : V;
export type FilterValueWithOperator<V extends FilterValueInput = FilterValueInput> = V extends string | number ?
    `!${V}` | `!~${V}` | `~${V}` | `${V}~` | `~${V}~` | `<${V}` | `<=${V}` | `>${V}` | `>=${V}` | null | '!null' :
    V extends boolean ? null | '!null' : never;

export type FilterValue<V extends FilterValueInput = FilterValueInput> = V extends string | number ?
    (FilterValueSimple<V> | FilterValueWithOperator<V> | Array<FilterValueWithOperator<V>>) :
    V;

export type FilterValueConfig<V extends FilterValueInput = FilterValueInput> = {
    operator: `${FilterOperator}` | (`${FilterOperator}`)[];
    value: FilterValueSimple<V>
};

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

export type FiltersBuildInputValue<T> = T extends OnlyScalar<T> ?
    T | FilterValue<T> | FilterValueConfig<T> :
    never;

export type FiltersBuildInput<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends Record<string, any> ?
        FiltersBuildInput<Flatten<T[K]>> :
        FiltersBuildInputValue<Flatten<T[K]>>
} & {
    [K in NestedKeys<T>]?: FiltersBuildInputValue<TypeFromNestedKeyPath<T, K>>
};

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------

export type FiltersDefaultKeys<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        FiltersDefaultKeys<Flatten<T[K]>> :
        (K extends string ? FilterValue<TypeFromNestedKeyPath<T, K>> : never)
} | {
    [K in NestedKeys<T>]?: FilterValue<TypeFromNestedKeyPath<T, K>>
};

export type FiltersValidator<K extends string> = (key: K, value: unknown) => boolean;

export type FiltersParseOptions<
    T extends ObjectLiteral = ObjectLiteral,
    > = {
        mapping?: Record<string, string>,
        allowed?: ParseAllowedKeys<T>,
        default?: FiltersDefaultKeys<T>,
        defaultByElement?: boolean,
        defaultPath?: string,
        relations?: RelationsParseOutput,
        validate?: FiltersValidator<NestedKeys<T>>
    };

export type FiltersParseOutputElement = {
    operator?: {
        [K in FilterOperatorLabel]?: boolean
    },
    value: FilterValueSimple,
    key: string,
    path?: string
};
export type FiltersParseOutput = FiltersParseOutputElement[];
