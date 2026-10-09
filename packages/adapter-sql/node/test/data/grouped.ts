/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Aggregate,
    Aggregates,
    Filter,
    Filters,
    Group,
    Groups,
    Pagination,
    Query,
    Relation,
    Relations,
} from '@rapiq/core';

/** `bucket(<field>,<unit>)`, resolved as the parser would resolve it. */
export const bucketGroup = (unit: string, field = 'createdAt') => new Group({
    name: 'bucket',
    params: [field, unit],
    lowering: {
        fn: 'bucket', 
        field, 
        args: [unit], 
    },
});

/** A bare-column group key. */
export const columnGroup = (field: string) => new Group({
    name: field,
    lowering: {
        fn: undefined, 
        field, 
        args: [], 
    },
});

/** `count` (rows) or `count(<field>)` (non-null values). */
export const countAggregate = (field?: string) => new Aggregate({
    name: 'count',
    params: field ? [field] : [],
    lowering: {
        fn: 'count', 
        field, 
        args: [], 
    },
});

export const sumAggregate = (field: string) => new Aggregate({
    name: 'sum',
    params: [field],
    lowering: {
        fn: 'sum', 
        field, 
        args: [], 
    },
});

/**
 * The #938 issue URL:
 * `filter[realmId]=r1,null&include=realm&group=bucket(createdAt,day),scope,name&aggregate=count&page[limit]=100`.
 */
export const buildIssueQuery = (unit = 'day') => new Query({
    filters: new Filters('and', [new Filter('in', 'realmId', ['r1', null])]),
    relations: new Relations([new Relation('realm')]),
    groups: new Groups([bucketGroup(unit), columnGroup('scope'), columnGroup('name')]),
    aggregates: new Aggregates([countAggregate()]),
    pagination: new Pagination(100, 0),
});
