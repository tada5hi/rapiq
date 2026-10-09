/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { CallSlot } from './types';

export enum GroupFunction {
    BUCKET = 'bucket',
}

export enum AggregateFunction {
    COUNT = 'count',
    SUM = 'sum',
}

export enum BucketUnit {
    HOUR = 'hour',
    DAY = 'day',
    MONTH = 'month',
}

/**
 * Positional slots of each primitive, in wire order. The only optional
 * slot is the field of count: count() counts rows, count(f) counts
 * non-null values of f.
 */
export const GROUP_FUNCTION_SLOTS : Record<`${GroupFunction}`, CallSlot[]> = {
    [GroupFunction.BUCKET]: [
        { name: 'field', optional: false },
        { name: 'unit', optional: false },
    ],
};

export const AGGREGATE_FUNCTION_SLOTS : Record<`${AggregateFunction}`, CallSlot[]> = {
    [AggregateFunction.COUNT]: [{ name: 'field', optional: true }],
    [AggregateFunction.SUM]: [{ name: 'field', optional: false }],
};
