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
    GroupFunction,
    isBucketUnit,
    isGroupedQuery,
    resolveGroupedSorts,
} from '@rapiq/core';
import type { DialectOptions } from '../../dialect';
import type { IFiltersAdapter } from '../filters';
import type { GroupedClauses } from './types';

function buildGroupExpression(
    group: IGroup,
    filters: IFiltersAdapter,
    bucket: DialectOptions['bucket'],
) : string {
    const { lowering } = group;
    if (!lowering || !lowering.field) {
        throw AdapterError.featureUnsupported('groups:unresolved');
    }

    if (typeof lowering.fn === 'undefined') {
        return filters.buildField(lowering.field);
    }

    if (lowering.fn !== GroupFunction.BUCKET) {
        throw AdapterError.featureUnsupported(`groups:${lowering.fn}`);
    }

    if (!bucket) {
        throw AdapterError.featureUnsupported('groups:bucket');
    }

    // the unit is inlined into the statement, never bound, so only the
    // closed enum may reach the dialect callback.
    const [unit] = lowering.args;
    if (!isBucketUnit(unit)) {
        throw AdapterError.keyValueInvalid(group.key);
    }

    const kind = filters.temporalKind ? filters.temporalKind(lowering.field) : 'datetime';
    if (!kind) {
        throw AdapterError.featureUnsupported('groups:bucket-type');
    }

    return bucket(filters.buildField(lowering.field), unit, kind);
}

function buildAggregateExpression(
    aggregate: IAggregate,
    filters: IFiltersAdapter,
) : string {
    const { lowering } = aggregate;
    if (!lowering) {
        throw AdapterError.featureUnsupported('aggregates:unresolved');
    }

    switch (lowering.fn) {
        case AggregateFunction.COUNT: {
            return lowering.field ?
                `count(${filters.buildField(lowering.field)})` :
                'count(*)';
        }
        case AggregateFunction.SUM: {
            if (!lowering.field) {
                throw AdapterError.featureUnsupported('aggregates:unresolved');
            }

            return `sum(${filters.buildField(lowering.field)})`;
        }
        default: {
            throw AdapterError.featureUnsupported(`aggregates:${lowering.fn}`);
        }
    }
}

/**
 * Render the select, group by and order by parts of a grouped query.
 * Columns resolve through the filters adapter, so a backend's column
 * name mapping and root alias apply to group keys and measures alike.
 */
export function buildGroupedClauses(
    query: IQuery,
    filters: IFiltersAdapter,
    bucket?: DialectOptions['bucket'],
) : GroupedClauses {
    if (!isGroupedQuery(query)) {
        throw AdapterError.featureUnsupported('groups:empty');
    }

    if (query.fields.value.length > 0) {
        throw AdapterError.featureUnsupported('fields:grouped');
    }

    const groups = (query.groups?.value ?? []).map((group) => ({
        key: group.key,
        expression: buildGroupExpression(group, filters, bucket),
    }));

    const aggregates = (query.aggregates?.value ?? []).map((aggregate) => ({
        key: aggregate.key,
        expression: buildAggregateExpression(aggregate, filters),
    }));

    return {
        selects: [...groups, ...aggregates],
        groupBy: groups.map((group) => group.expression),
        orderBy: resolveGroupedSorts(query).map((sort) => ({
            key: sort.name,
            direction: sort.operator,
        })),
    };
}

/**
 * Project driver rows onto the query's output keys, in IR order. Group
 * values pass through (bucket text, the driver value of a bare column);
 * every aggregate becomes a number, so pg (bigint and numeric as text),
 * mysql (DECIMAL as text) and sqlite answer with one JSON type,
 * identical to @rapiq/adapter-memory. A sum beyond 2^53 or about 15
 * significant digits loses precision; read the raw rows instead when
 * exact decimals matter. A sum over no values stays null.
 *
 * A row lacking an output key is refused (`KEY_VALUE_INVALID`) rather
 * than read as null: the engine returned another alias, which happens
 * when an alias exceeds its identifier limit (63 bytes on pg, which
 * truncates it; 30 on Oracle before 12.2).
 */
export function normalizeGroupedRows(query: IQuery, rows: ObjectLiteral[]) : ObjectLiteral[] {
    const groups = query.groups?.value ?? [];
    const aggregates = query.aggregates?.value ?? [];

    const read = (row: ObjectLiteral, key: string) : unknown => {
        if (!(key in row)) {
            throw AdapterError.keyValueInvalid(key);
        }

        return row[key];
    };

    return rows.map((row) => {
        const output : ObjectLiteral = {};

        for (const group of groups) {
            output[group.key] = read(row, group.key);
        }

        for (const aggregate of aggregates) {
            const value = read(row, aggregate.key);
            output[aggregate.key] = value === null || typeof value === 'undefined' ?
                null :
                Number(value);
        }

        return output;
    });
}
