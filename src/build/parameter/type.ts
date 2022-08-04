/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FieldsBuildInput,
    FiltersBuildInput,
    PaginationBuildInput,
    RelationsBuildInput,
    SortBuildInput,
} from '../../parameter';

import {
    Parameter,
    URLParameter,
} from '../../constants';

export type BuildParameterInput<
    T extends `${Parameter}` | `${URLParameter}`,
    R extends Record<string, any> = Record<string, any>,
    > =
    T extends `${Parameter.FIELDS}` | `${URLParameter.FIELDS}` ?
        FieldsBuildInput<R> :
        T extends `${Parameter.FILTERS}` | `${URLParameter.FILTERS}` ?
            FiltersBuildInput<R> :
            T extends `${Parameter.RELATIONS}` | `${URLParameter.RELATIONS}` ?
                RelationsBuildInput<R> :
                T extends `${Parameter.PAGINATION}` | `${URLParameter.PAGINATION}` ?
                    PaginationBuildInput<R> :
                    T extends `${Parameter.SORT}` | `${URLParameter.SORT}` ?
                        SortBuildInput<R> :
                        never;
