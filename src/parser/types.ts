/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../constants';
import type {
    FieldsParseOutput, FiltersParseOutput, PaginationParseOutput, RelationsParseOutput, SortParseOutput,
} from './index';
import type { Schema, SchemaRegistry } from '../schema';
import type { ObjectLiteral, ObjectLiteralKeys } from '../types';

export type ParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    registry?: SchemaRegistry,
    fields?: boolean,
    filters?: boolean,
    relations?: boolean,
    pagination?: boolean,
    sort?: boolean,
    schema?: Schema<RECORD> | string
};

export type QueryParseParameterOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    schema?: Schema<RECORD> | string,
    relations?: RelationsParseOutput,
};

export type ParseParametersOutput = ObjectLiteralKeys<{
    [Parameter.FIELDS]?: FieldsParseOutput,
    [Parameter.FILTERS]?: FiltersParseOutput,
    [Parameter.RELATIONS]?: RelationsParseOutput,
    [Parameter.PAGINATION]?: PaginationParseOutput,
    [Parameter.SORT]?: SortParseOutput,
}>;

export type ParseOutput = ParseParametersOutput & {
    defaultPath?: string
};
