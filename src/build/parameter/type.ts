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
    P extends `${Parameter}` | `${URLParameter}`,
    T extends Record<string, any> = Record<string, any>,
    > =
    P extends `${Parameter.FIELDS}` | `${URLParameter.FIELDS}` ?
        FieldsBuildInput<T> :
        P extends `${Parameter.FILTERS}` | `${URLParameter.FILTERS}` ?
            FiltersBuildInput<T> :
            P extends `${Parameter.RELATIONS}` | `${URLParameter.RELATIONS}` ?
                RelationsBuildInput<T> :
                P extends `${Parameter.PAGINATION}` | `${URLParameter.PAGINATION}` ?
                    PaginationBuildInput :
                    P extends `${Parameter.SORT}` | `${URLParameter.SORT}` ?
                        SortBuildInput<T> :
                        never;
