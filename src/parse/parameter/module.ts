/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationsParseOutput } from '../../parameter';
import {
    parseQueryFields, parseQueryFilters, parseQueryPagination, parseQueryRelations, parseQuerySort,
} from '../../parameter';
import {
    Parameter, URLParameter,
} from '../../constants';
import type { ObjectLiteral } from '../../type';
import type { ParseParameterOptions, ParseParameterOutput } from './type';

export function parseQueryParameter<
    P extends `${Parameter}` | `${URLParameter}`,
    T extends ObjectLiteral = ObjectLiteral,
    >(
    key: P,
    data: unknown,
    options?: ParseParameterOptions<P, T>,
    relations?: RelationsParseOutput,
): ParseParameterOutput<P> {
    switch (key) {
        case Parameter.FIELDS:
        case URLParameter.FIELDS:
            return (parseQueryFields(
                data,
                {
                    ...(invalidToEmptyObject(options)) as ParseParameterOptions<Parameter.FIELDS>,
                    ...(relations ? { relations } : {}),
                },
            ) as ParseParameterOutput<P>);
        case Parameter.FILTERS:
        case URLParameter.FILTERS:
            return (parseQueryFilters(
                data,
                {
                    ...(invalidToEmptyObject(options)) as ParseParameterOptions<Parameter.FILTERS>,
                    ...(relations ? { relations } : {}),
                },
            ) as ParseParameterOutput<P>);
        case Parameter.PAGINATION:
        case URLParameter.PAGINATION:
            return (parseQueryPagination(
                data,
                {
                    ...(invalidToEmptyObject(options)) as ParseParameterOptions<Parameter.PAGINATION>,
                },
            ) as ParseParameterOutput<P>);
        case Parameter.RELATIONS:
        case URLParameter.RELATIONS:
            return (parseQueryRelations(
                data,
                {
                    ...(invalidToEmptyObject(options)) as ParseParameterOptions<Parameter.RELATIONS>,
                },
            ) as ParseParameterOutput<P>);
        default:
            return (parseQuerySort(
                data,
                {
                    ...(invalidToEmptyObject(options)) as ParseParameterOptions<Parameter.SORT>,
                    ...(relations ? { relations } : {}),
                },
            ) as ParseParameterOutput<P>);
    }
}

function invalidToEmptyObject<V>(
    value: V | boolean,
): NonNullable<V> {
    return typeof value === 'boolean' ||
        typeof value === 'undefined' ?
        {} as NonNullable<V> :
        value as NonNullable<V>;
}
