/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FieldsParseOptions,
    FieldsParseOutput,
    FiltersParseOptions,
    FiltersParseOutput,
    PaginationParseOptions,
    PaginationParseOutput,
    RelationsParseOptions,
    RelationsParseOutput,
    SortParseOptions,
    SortParseOutput,
} from '../../parameter';

import { Parameter, URLParameter } from '../../constants';

export type ParseParameterOptions<
    P extends `${Parameter}` | `${URLParameter}`,
    T extends Record<string, any> = Record<string, any>,
    > =
    P extends `${Parameter.FIELDS}` | `${URLParameter.FIELDS}` ?
        FieldsParseOptions<T> :
        P extends `${Parameter.FILTERS}` | `${URLParameter.FILTERS}` ?
            FiltersParseOptions<T> :
            P extends `${Parameter.RELATIONS}` | `${URLParameter.RELATIONS}` ?
                RelationsParseOptions<T> :
                P extends `${Parameter.PAGINATION}` | `${URLParameter.PAGINATION}` ?
                    PaginationParseOptions :
                    P extends `${Parameter.SORT}` | `${URLParameter.SORT}` ?
                        SortParseOptions<T> :
                        never;

export type ParseParameterOutput<P extends `${Parameter}` | `${URLParameter}`> =
    P extends `${Parameter.FIELDS}` | `${URLParameter.FIELDS}` ?
        FieldsParseOutput :
        P extends `${Parameter.FILTERS}` | `${URLParameter.FILTERS}` ?
            FiltersParseOutput :
            P extends `${Parameter.RELATIONS}` | `${URLParameter.RELATIONS}` ?
                RelationsParseOutput :
                P extends `${Parameter.PAGINATION}` | `${URLParameter.PAGINATION}` ?
                    PaginationParseOutput :
                    P extends `${Parameter.SORT}` | `${URLParameter.SORT}` ?
                        SortParseOutput :
                        never;
