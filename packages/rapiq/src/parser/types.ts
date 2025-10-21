/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../constants';
import type { Relations } from '../parameter';
import type { Schema, SchemaRegistry } from '../schema';
import type { ObjectLiteral, ObjectLiteralKeys } from '../types';
import type {
    FieldsBuildInput, FiltersBuildInput, PaginationBuildInput, RelationsBuildInput, SortBuildInput,
} from './parameter';

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

export type ParseParameterOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = IParserOptions & {
    schema?: Schema<RECORD> | string,
    relations?: Relations,
};

export type IParserOptions = {
    async?: boolean,
};

export interface IParser<
Input = any,
Output = any,
Options extends IParserOptions = IParserOptions,
> {
    parse(input: Input, options?: Options): Output;
}

export type ParserInput<
    T extends ObjectLiteral,
> = ObjectLiteralKeys<{
    [Parameter.FIELDS]?: FieldsBuildInput<T>,
    [Parameter.FILTERS]?: FiltersBuildInput<T>,
    [Parameter.RELATIONS]?: RelationsBuildInput<T>,
    [Parameter.PAGINATION]?: PaginationBuildInput,
    [Parameter.SORT]?: SortBuildInput<T>,
}>;
