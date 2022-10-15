/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../constants';
import {
    Flatten, OnlyObject, OnlyScalar, ParseOptionsBase, ParseOutputElementBase,
} from '../type';
import { FilterOperator, FilterOperatorLabel } from './constants';

// -----------------------------------------------------------

type FilterValueInputPrimitive = boolean | number | string;
type FilterValueInput = FilterValueInputPrimitive | null | undefined;

export type FilterValueSimple<V extends FilterValueInput = FilterValueInput> = V extends FilterValueInputPrimitive ? (V | V[]) : V;
export type FilterValueWithOperator<V extends FilterValueInput = FilterValueInput> = V extends string | number ?
    `!${V}` | `!~${V}` | `~${V}` | `<${V}` | `<=${V}` | `>${V}` | `>=${V}` :
    never;

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
    T extends OnlyObject<T> ? FiltersBuildInput<Flatten<T>> : never;

export type FiltersBuildInput<T> = {
    [K in keyof T]?: FiltersBuildInputValue<T[K]>
};

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------

export type FiltersParseOptions = ParseOptionsBase<Parameter.FILTERS> & {
    default?: Record<string, FilterValue<any>>,
    defaultByElement?: boolean
};

export type FiltersParseOutputElement = ParseOutputElementBase<Parameter.FILTERS, FilterValueSimple> & {
    operator?: {
        [K in FilterOperatorLabel]?: boolean
    }
};
export type FiltersParseOutput = FiltersParseOutputElement[];
