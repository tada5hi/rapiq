/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

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
} from '../../parameter';

import type { Parameter } from '../../constants';
import type { ObjectLiteral } from '../../type';

export type ParseParametersOptions<T extends ObjectLiteral = ObjectLiteral> = {
    [Parameter.FIELDS]?: FieldsParseOptions<T> | boolean,
    [Parameter.FILTERS]?: FiltersParseOptions<T> | boolean,
    [Parameter.RELATIONS]?: RelationsParseOptions<T> | boolean,
    [Parameter.PAGINATION]?: PaginationParseOptions | boolean,
    [Parameter.SORT]?: SortParseOptions<T> | boolean,
};

export type ParseParametersOutput = {
    [Parameter.FIELDS]?: FieldsParseOutput | boolean,
    [Parameter.FILTERS]?: FiltersParseOutput | boolean,
    [Parameter.RELATIONS]?: RelationsParseOutput | boolean,
    [Parameter.PAGINATION]?: PaginationParseOutput | boolean,
    [Parameter.SORT]?: SortParseOutput | boolean,
};
