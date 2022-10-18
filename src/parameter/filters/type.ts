/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Flatten,
    NestedKeys, OnlyObject, OnlyScalar, TypeFromNestedKeyPath,
} from '../../type';
import { RelationsParseOutput } from '../relations';
import {
    ParseOptionsAllowed,
} from '../type';
import { FilterOperator, FilterOperatorLabel } from './constants';

// -----------------------------------------------------------

type FilterValueInputPrimitive = boolean | number | string;
type FilterValueInput = FilterValueInputPrimitive | null | undefined;

export type FilterValueSimple<V extends FilterValueInput = FilterValueInput> = V extends FilterValueInputPrimitive ? (V | V[]) : V;
export type FilterValueWithOperator<V extends FilterValueInput = FilterValueInput> = V extends string | number ?
    `!${V}` | `!~${V}` | `~${V}` | `${V}~` | `~${V}~` | `<${V}` | `<=${V}` | `>${V}` | `>=${V}` | null | '!null' :
    V extends boolean ? null | '!null' : never;

export type FilterValue<V extends FilterValueInput = FilterValueInput> = V extends FilterValueInputPrimitive ?
    (FilterValueSimple<V> | FilterValueWithOperator<V> | Array<FilterValueWithOperator<V>>) :
    V;

export type FilterOperatorConfig<V extends FilterValueInput = FilterValueInput> = {
    operator: `${FilterOperator}` | (`${FilterOperator}`)[];
    value: FilterValueSimple<V>
};

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

export type FiltersBuildInputValue<T> = T extends OnlyScalar<T> ?
    T | FilterValue<T> | FilterOperatorConfig<T> :
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

export type FiltersParseOptionsDefault<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        FiltersParseOptionsDefault<Flatten<T[K]>> :
        (K extends string ? FilterValue<TypeFromNestedKeyPath<T, K>> : never)
} | {
    [K in NestedKeys<T>]?: FilterValue<TypeFromNestedKeyPath<T, K>>
};

export type FiltersParseOptions<
    T extends Record<string, any> = Record<string, any>,
    > = {
        mapping?: Record<string, string>,
        allowed?: ParseOptionsAllowed<T>,
        default?: FiltersParseOptionsDefault<T>,
        defaultByElement?: boolean,
        relations?: RelationsParseOutput
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
