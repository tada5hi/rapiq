/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { BucketUnit, QueryContext } from '@rapiq/core';
import {
    Aggregate,
    AggregateFunction,
    Aggregates,
    Group,
    GroupFunction,
    Groups,
    Query,
} from '@rapiq/core';

export function column(name: string) : Group {
    return new Group({
        name,
        lowering: {
            fn: undefined,
            field: name,
            args: [],
        },
    });
}

export function bucket(field: string, unit: `${BucketUnit}`) : Group {
    return new Group({
        name: GroupFunction.BUCKET,
        params: [field, unit],
        lowering: {
            fn: GroupFunction.BUCKET,
            field,
            args: [unit],
        },
    });
}

export function count(field?: string) : Aggregate {
    return new Aggregate({
        name: AggregateFunction.COUNT,
        params: field ? [field] : [],
        lowering: {
            fn: AggregateFunction.COUNT,
            field,
            args: [],
        },
    });
}

export function sum(field: string) : Aggregate {
    return new Aggregate({
        name: AggregateFunction.SUM,
        params: [field],
        lowering: {
            fn: AggregateFunction.SUM,
            field,
            args: [],
        },
    });
}

export function grouped(
    groups: Group[],
    aggregates: Aggregate[],
    context: Omit<QueryContext, 'groups' | 'aggregates'> = {},
) : Query {
    return new Query({
        ...context,
        groups: new Groups(groups),
        aggregates: new Aggregates(aggregates),
    });
}
