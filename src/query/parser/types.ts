/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter, URLParameter } from '../../constants';
import type {
    FieldsParseOutput,
    FiltersParseOutput,
    PaginationParseOutput,
    RelationsParseOutput,
    SortParseOutput,
} from '../../parameter';
import type { Schema, SchemaRegistry } from '../../schema';
import type { ObjectLiteralKeys } from '../../types';

export type QueryParseOptions = {
    registry?: SchemaRegistry,
    fields?: boolean,
    filters?: boolean,
    relations?: boolean,
    pagination?: boolean,
    sort?: boolean,
    schema?: Schema | string
};

export type QueryParseParameterOptions = {
    schema?: Schema | string,
    relations?: RelationsParseOutput,
};

export type QueryParseInput = {
    [K in `${Parameter}` | `${URLParameter}`]?: unknown
};

export type QueryParseParametersOutput = ObjectLiteralKeys<{
    [Parameter.FIELDS]?: FieldsParseOutput,
    [Parameter.FILTERS]?: FiltersParseOutput,
    [Parameter.RELATIONS]?: RelationsParseOutput,
    [Parameter.PAGINATION]?: PaginationParseOutput,
    [Parameter.SORT]?: SortParseOutput,
}>;

export type QueryParseOutput = QueryParseParametersOutput & {
    defaultPath?: string
};
