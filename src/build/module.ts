/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BuildInput, BuildOptions } from './type';
import {
    buildQueryFieldsForMany,
    buildQueryFiltersForMany,
    buildQueryPaginationForMany,
    buildQueryRelationsForMany,
    buildQuerySortForMany,
} from '../parameter';
import { Parameter, URLParameter } from '../constants';
import {
    buildURLQueryString,
} from '../utils';

export function buildQuery<T extends Record<string, any>>(
    input?: BuildInput<T>,
    options?: BuildOptions,
) : string {
    if (
        typeof input === 'undefined' ||
        input === null
    ) {
        return '';
    }

    const query: { [key in URLParameter]?: unknown } = {};

    if (
        typeof input[Parameter.FIELDS] !== 'undefined' ||
        typeof input[URLParameter.FIELDS] !== 'undefined'
    ) {
        query[URLParameter.FIELDS] = buildQueryFieldsForMany([
            ...(input[Parameter.FIELDS] ? [input[Parameter.FIELDS]] : []),
            ...(input[URLParameter.FIELDS] ? [input[URLParameter.FIELDS]] : []),
        ]);
    }

    if (
        typeof input[Parameter.FILTERS] !== 'undefined' ||
        typeof input[URLParameter.FILTERS] !== 'undefined'
    ) {
        query[URLParameter.FILTERS] = buildQueryFiltersForMany([
            ...(input[Parameter.FILTERS] ? [input[Parameter.FILTERS]] : []),
            ...(input[URLParameter.FILTERS] ? [input[URLParameter.FILTERS]] : []),
        ]);
    }

    if (
        typeof input[Parameter.PAGINATION] !== 'undefined' ||
        typeof input[URLParameter.PAGINATION] !== 'undefined'
    ) {
        query[URLParameter.PAGINATION] = buildQueryPaginationForMany([
            ...(input[Parameter.PAGINATION] ? [input[Parameter.PAGINATION]] : []),
            ...(input[URLParameter.PAGINATION] ? [input[URLParameter.PAGINATION]] : []),
        ]);
    }

    if (
        typeof input[Parameter.RELATIONS] !== 'undefined' ||
        typeof input[URLParameter.RELATIONS] !== 'undefined'
    ) {
        query[URLParameter.RELATIONS] = buildQueryRelationsForMany([
            ...(input[Parameter.RELATIONS] ? [input[Parameter.RELATIONS]] : []),
            ...(input[URLParameter.RELATIONS] ? [input[URLParameter.RELATIONS]] : []),
        ]);
    }

    if (
        typeof input[Parameter.SORT] !== 'undefined' ||
        typeof input[URLParameter.SORT] !== 'undefined'
    ) {
        query[URLParameter.SORT] = buildQuerySortForMany([
            ...(input[Parameter.SORT] ? [input[Parameter.SORT]] : []),
            ...(input[URLParameter.SORT] ? [input[URLParameter.SORT]] : []),
        ]);
    }

    return buildURLQueryString(query);
}
