/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter, URLParameter } from '../constants';
import type {
    FieldsBuildInput,
    FiltersBuildInput,
    PaginationBuildInput,
    RelationsBuildInput,
    SortBuildInput,
} from '../parameter';
import type { ObjectLiteral, ObjectLiteralKeys } from '../types';

type BuildParametersInput<
    T extends ObjectLiteral = ObjectLiteral,
> = ObjectLiteralKeys<{
    [Parameter.FIELDS]?: FieldsBuildInput<T>,
    [Parameter.FILTERS]?: FiltersBuildInput<T>,
    [Parameter.RELATIONS]?: RelationsBuildInput<T>,
    [Parameter.PAGINATION]?: PaginationBuildInput,
    [Parameter.SORT]?: SortBuildInput<T>,
}>;

export type BuildURLParametersInput<
    T extends ObjectLiteral = ObjectLiteral,
> = ObjectLiteralKeys<{
    [URLParameter.FIELDS]?: FieldsBuildInput<T>,
    [URLParameter.FILTERS]?: FiltersBuildInput<T>,
    [URLParameter.RELATIONS]?: RelationsBuildInput<T>,
    [URLParameter.PAGINATION]?: PaginationBuildInput,
    [URLParameter.SORT]?: SortBuildInput<T>,
}>;

export type BuildInput<
    T extends ObjectLiteral,
> = BuildParametersInput<T> &
BuildURLParametersInput<T>;
