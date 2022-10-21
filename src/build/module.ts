/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ObjectLiteral } from '../type';
import { BuildInput } from './type';
import {
    buildQueryFields,
    buildQueryFilters,
    buildQueryRelations,
    buildQuerySort,
    mergeQueryFields,
    mergeQueryFilters,
    mergeQueryPagination,
    mergeQueryRelations,
    mergeQuerySort,
} from '../parameter';
import { Parameter, URLParameter } from '../constants';
import {
    buildURLQueryString,
} from '../utils';

export function buildQuery<T extends ObjectLiteral = ObjectLiteral>(
    input?: BuildInput<T>,
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
        query[URLParameter.FIELDS] = mergeQueryFields(
            buildQueryFields(input[Parameter.FIELDS]),
            buildQueryFields(input[URLParameter.FIELDS]),
        );
    }

    if (
        typeof input[Parameter.FILTERS] !== 'undefined' ||
        typeof input[URLParameter.FILTERS] !== 'undefined'
    ) {
        query[URLParameter.FILTERS] = mergeQueryFilters(
            buildQueryFilters(input[Parameter.FILTERS]),
            buildQueryFilters(input[URLParameter.FILTERS]),
        );
    }

    if (
        typeof input[Parameter.PAGINATION] !== 'undefined' ||
        typeof input[URLParameter.PAGINATION] !== 'undefined'
    ) {
        query[URLParameter.PAGINATION] = mergeQueryPagination(
            input[Parameter.PAGINATION],
            input[URLParameter.PAGINATION],
        );
    }

    if (
        typeof input[Parameter.RELATIONS] !== 'undefined' ||
        typeof input[URLParameter.RELATIONS] !== 'undefined'
    ) {
        query[URLParameter.RELATIONS] = mergeQueryRelations(
            buildQueryRelations(input[Parameter.RELATIONS]),
            buildQueryRelations(input[URLParameter.RELATIONS]),
        );
    }

    if (
        typeof input[Parameter.SORT] !== 'undefined' ||
        typeof input[URLParameter.SORT] !== 'undefined'
    ) {
        query[URLParameter.SORT] = mergeQuerySort(
            buildQuerySort(input[Parameter.SORT]),
            buildQuerySort(input[URLParameter.SORT]),
        );
    }

    return buildURLQueryString(query);
}
