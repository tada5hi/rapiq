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
    Sorts,
    isGroupedQuery,
    resolveGroupedSorts,
} from '@rapiq/core';
import { resolvePath } from '../helpers';
import type { QueryVisitorOptions } from '../module';
import { FiltersVisitor, PaginationVisitor, SortsVisitor } from '../parameter';
import type { ApplyOutput } from '../types';

type GroupReader = (record: unknown) => unknown;

type AggregateReducer = (records: unknown[]) => unknown;

type GroupBucket = { values: unknown[], records: unknown[] };

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

    throw AdapterError.featureUnsupported(`groups:${fn}`);
}

function compileAggregate(aggregate: IAggregate) : AggregateReducer {
    const { lowering } = aggregate;
    if (!lowering || typeof lowering.fn === 'undefined') {
        throw AdapterError.featureUnsupported('aggregates:unresolved');
    }

    const { fn, field } = lowering;
    if (fn === AggregateFunction.COUNT && typeof field === 'undefined') {
        return (records) => records.length;
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
    if (!isGroupedQuery(query)) {
        throw AdapterError.featureUnsupported('groups:empty');
    }

    if (query.fields.value.length > 0) {
        throw AdapterError.featureUnsupported('fields:grouped');
    }

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
        for (const record of data) {
            if (!predicate(record)) {
                continue;
            }

            const values = groups.map((group) => group.read(record));
            // JSON keeps 1 and '1' apart and reads a Date as its ISO instant.
            const identity = JSON.stringify(values);
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
