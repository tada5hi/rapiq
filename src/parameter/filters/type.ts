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
// Build
// -----------------------------------------------------------

export type FilterOperatorConfig<V extends string | number | boolean | null | undefined> = {
    operator: `${FilterOperator}` | (`${FilterOperator}`)[];
    value: V | V[]
};

export type FilterOperatorLabelType = `${FilterOperatorLabel}`;

type FilterValue<V> = V extends string | number | boolean ? (V | V[]) : never;
type FilterValueWithOperator<V> = V extends string | number | boolean ?
    (FilterValue<V> | FilterValueOperator<V> | Array<FilterValueOperator<V>>) :
    never;

type FilterValueOperator<V extends string | number | boolean> = `!${V}` | `!~${V}` | `~${V}` | `<${V}` | `<=${V}` | `>${V}` | `>=${V}`;

export type FiltersBuildInputValue<T> = T extends OnlyScalar<T> ?
    T | FilterValueWithOperator<T> | FilterOperatorConfig<T> :
    T extends OnlyObject<T> ? FiltersBuildInput<Flatten<T>> : never;

export type FiltersBuildInput<T> = {
    [K in keyof T]?: FiltersBuildInputValue<T[K]>
};

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------

export type FiltersParseOptions = ParseOptionsBase<Parameter.FILTERS>;

export type FiltersParseOutputElement = ParseOutputElementBase<Parameter.FILTERS, FilterValue<string | number | boolean | null>> & {
    operator?: {
        [K in FilterOperatorLabel]?: boolean
    }
};
export type FiltersParseOutput = FiltersParseOutputElement[];
