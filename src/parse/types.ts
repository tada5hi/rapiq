/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter, URLParameter } from '../constants';
import type {
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
} from '../parameter';
import type { ObjectLiteral, ObjectLiteralKeys } from '../types';

//------------------------------------------------

export type ParseInput = {
    [K in `${Parameter}` | `${URLParameter}`]?: unknown
};

//------------------------------------------------

export type ParseParametersOptions<
    T extends ObjectLiteral = ObjectLiteral,
> = ObjectLiteralKeys<{
    [Parameter.FIELDS]?: FieldsParseOptions<T> | boolean,
    [Parameter.FILTERS]?: FiltersParseOptions<T> | boolean,
    [Parameter.RELATIONS]?: RelationsParseOptions<T> | boolean,
    [Parameter.PAGINATION]?: PaginationParseOptions | boolean,
    [Parameter.SORT]?: SortParseOptions<T> | boolean,
}>;

export type ParseParametersOutput = ObjectLiteralKeys<{
    [Parameter.FIELDS]?: FieldsParseOutput,
    [Parameter.FILTERS]?: FiltersParseOutput,
    [Parameter.RELATIONS]?: RelationsParseOutput,
    [Parameter.PAGINATION]?: PaginationParseOutput,
    [Parameter.SORT]?: SortParseOutput,
}>;

export type ParseOptions<
    T extends ObjectLiteral = ObjectLiteral,
> = ParseParametersOptions<T> & {
    defaultPath?: string,
    throwOnFailure?: boolean
};

//------------------------------------------------

export type ParseOutput = ParseParametersOutput & {
    defaultPath?: string
};
