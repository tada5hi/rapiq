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
    ParseAllowedOption,
} from '../type';
import { FilterComparisonOperator } from './constants';

// -----------------------------------------------------------

type FilterValueInputPrimitive = boolean | number | string;
type FilterValueInput = FilterValueInputPrimitive | null | undefined;

export type FilterValueSimple<V extends FilterValueInput = FilterValueInput> = V extends string | number ? (V | V[]) : V;
export type FilterValueWithOperator<V extends FilterValueInput = FilterValueInput> = V extends string | number ?
    V | `!${V}` | `!~${V}` | `~${V}` | `<${V}` | `<=${V}` | `>${V}` | `>=${V}` | null | '!null' :
    V extends boolean ? V | null | '!null' : never;

export type FilterValue<V extends FilterValueInput = FilterValueInput> = V extends string | number ?
    (FilterValueSimple<V> | FilterValueWithOperator<V> | Array<FilterValueWithOperator<V>>) :
    V;

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

export type FiltersBuildInputValue<T> = T extends OnlyScalar<T> ? T | FilterValue<T> : never;

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

export type FiltersParseDefaultOption<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        FiltersParseDefaultOption<Flatten<T[K]>> :
        (K extends string ? FilterValue<TypeFromNestedKeyPath<T, K>> : never)
} | {
    [K in NestedKeys<T>]?: FilterValue<TypeFromNestedKeyPath<T, K>>
};

export type FiltersValidatorOption<K extends string> = (key: K, value: unknown) => boolean;

export type FiltersParseOptions<
    T extends ObjectLiteral = ObjectLiteral,
    > = {
        mapping?: Record<string, string>,
        allowed?: ParseAllowedOption<T>,
        default?: FiltersParseDefaultOption<T>,
        defaultByElement?: boolean,
        defaultPath?: string,
        relations?: RelationsParseOutput,
        validate?: FiltersValidatorOption<NestedKeys<T>>
    };

export type FiltersParseOutputElement = {
    operator?: `${FilterComparisonOperator}`,
    value: FilterValueSimple,
    key: string,
    path?: string
};
export type FiltersParseOutput = FiltersParseOutputElement[];
