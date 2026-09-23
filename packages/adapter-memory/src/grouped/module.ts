/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IAggregate,
    IGroup,
    IQuery,
    ObjectLiteral,
} from '@rapiq/core';
import {
    AdapterError,
    AggregateFunction,
    BucketUnit,
    GroupFunction,
    Sorts,
    assertGroupedQuery,
    isBucketUnit,
    resolveGroupedSorts,
    toDate,
} from '@rapiq/core';
import { resolvePath } from '../helpers';
import type { QueryVisitorOptions } from '../module';
import { FiltersVisitor, PaginationVisitor, SortsVisitor } from '../parameter';
import type { ApplyOutput } from '../types';

type GroupReader = (record: unknown) => unknown;

type AggregateReducer = (records: unknown[]) => unknown;

type GroupBucket = { values: unknown[], records: unknown[] };

/**
 * Truncate a value to the start of its UTC unit and render it as the
 * text every adapter returns for a bucket. The value is read with the
 * filter operand rules (`toDate`): a Date, an ISO string (zone-less
 * means UTC) or epoch milliseconds; anything else is the null bucket.
 * UTC setters on a copy, never local ones, so the host zone cannot
 * move a record into another bucket.
 */
function truncateToBucket(value: unknown, unit: string) : string | null {
    const date = toDate(value);
    if (!date) {
        return null;
    }

    const output = new Date(date.getTime());
    if (unit === BucketUnit.HOUR) {
        output.setUTCMinutes(0, 0, 0);
    } else {
        output.setUTCHours(0, 0, 0, 0);
    }

    if (unit === BucketUnit.MONTH) {
        output.setUTCDate(1);
    }

    return output.toISOString();
}

/**
 * Read a value the way `normalizeGroupedRows` (adapter-sql) reads a SQL
 * sum: with `Number`. A record hydrated by a driver
 * carries a decimal as a string and a pg bigint as a string or bigint,
 * so those count; a blank string, which `Number` reads as 0, does not.
 * Anything else (null, a boolean, a Date, a non-numeric string) is
 * skipped.
 */
function toSummand(value: unknown) : number | undefined {
    const numeric = typeof value === 'number' ||
        typeof value === 'bigint' ||
        (typeof value === 'string' && value.trim().length > 0);
    if (!numeric) {
        return undefined;
    }

    const output = Number(value);

    return Number.isFinite(output) ? output : undefined;
}

function compileGroup(group: IGroup) : GroupReader {
    const { lowering } = group;
    // every group reads a root column: a bare one or a bucket's.
    if (!lowering || typeof lowering.field === 'undefined') {
        throw AdapterError.featureUnsupported('groups:unresolved');
    }

    const { fn, field } = lowering;
    if (typeof fn === 'undefined') {
        return (record) => resolvePath(record, field);
    }

    if (fn === GroupFunction.BUCKET) {
        const [unit] = lowering.args;
        // hand-built IR only: the resolver admits nothing outside
        // BucketUnit. Same refusal as adapter-sql, which inlines the unit.
        if (!isBucketUnit(unit)) {
            throw AdapterError.keyValueInvalid(group.key);
        }

        return (record) => truncateToBucket(resolvePath(record, field), unit);
    }

    throw AdapterError.featureUnsupported(`groups:${fn}`);
}

function compileAggregate(aggregate: IAggregate) : AggregateReducer {
    const { lowering } = aggregate;
    if (!lowering || typeof lowering.fn === 'undefined') {
        throw AdapterError.featureUnsupported('aggregates:unresolved');
    }

    const { fn, field } = lowering;
    if (fn === AggregateFunction.COUNT) {
        if (typeof field === 'undefined') {
            return (records) => records.length;
        }

        return (records) => records.filter((record) => resolvePath(record, field) !== null).length;
    }

    if (fn === AggregateFunction.SUM && typeof field !== 'undefined') {
        return (records) => {
            let output : number | null = null;
            for (const record of records) {
                const value = toSummand(resolvePath(record, field));
                if (typeof value !== 'undefined') {
                    output = (output ?? 0) + value;
                }
            }

            return output;
        };
    }

    throw AdapterError.featureUnsupported(`aggregates:${fn}`);
}

/**
 * Compile a grouped query (groups and/or aggregates) into a function
 * evaluating it against in-memory records: filter, group, aggregate,
 * sort by the output keys, paginate. Every refusal happens here, before
 * any data is seen. Relations are ignored: a grouped row hydrates none.
 *
 * `total` is the number of groups before pagination, the same number a
 * SQL backend reports for the grouped series.
 */
export function compileGroupedQuery(
    query: IQuery,
    options: QueryVisitorOptions = {},
) : (data: unknown[]) => ApplyOutput<ObjectLiteral> {
    assertGroupedQuery(query);

    const groups = (query.groups?.value ?? []).map((group) => ({
        key: group.key,
        read: compileGroup(group),
    }));
    const aggregates = (query.aggregates?.value ?? []).map((aggregate) => ({
        key: aggregate.key,
        reduce: compileAggregate(aggregate),
    }));

    const predicate = query.filters.accept(new FiltersVisitor({ caseSensitive: options.caseSensitive }));
    const comparator = new Sorts(resolveGroupedSorts(query)).accept(new SortsVisitor<ObjectLiteral>());
    const slicer = query.pagination.accept(new PaginationVisitor());
    const { limit, offset } = query.pagination;

    return (data) => {
        const buckets = new Map<string, GroupBucket>();
        if (groups.length === 0) {
            // without group keys SQL answers one row, even over zero records.
            buckets.set(JSON.stringify([]), { values: [], records: [] });
        }

        for (const record of data) {
            if (!predicate(record)) {
                continue;
            }

            const values = groups.map((group) => group.read(record));
            // JSON keeps 1 and '1' apart and reads a Date as its ISO instant;
            // a bigint, which JSON refuses, is tagged to stay apart too.
            const identity = JSON.stringify(values, (_key, value) => (
                typeof value === 'bigint' ? { $bigint: String(value) } : value
            ));
            let bucket = buckets.get(identity);
            if (!bucket) {
                bucket = { values, records: [] };
                buckets.set(identity, bucket);
            }

            bucket.records.push(record);
        }

        const rows = Array.from(buckets.values(), (bucket) => {
            const row : ObjectLiteral = {};
            groups.forEach((group, index) => {
                row[group.key] = bucket.values[index];
            });
            for (const aggregate of aggregates) {
                row[aggregate.key] = aggregate.reduce(bucket.records);
            }

            return row;
        });

        rows.sort(comparator);

        return {
            data: slicer(rows),
            total: rows.length,
            pagination: { limit, offset },
        };
    };
}

export function applyGroupedQuery(
    query: IQuery,
    data: unknown[],
    options: QueryVisitorOptions = {},
) : ApplyOutput<ObjectLiteral> {
    return compileGroupedQuery(query, options)(data);
}
