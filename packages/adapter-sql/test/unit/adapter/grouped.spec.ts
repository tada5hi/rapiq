/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Aggregate,
    Aggregates,
    Field,
    Fields,
    Group,
    Groups,
    Query,
    Sort,
    Sorts,
} from '@rapiq/core';
import type { TemporalKind } from '../../../src';
import {
    Adapter,
    FiltersAdapter,
    RelationsAdapter,
    buildGroupedClauses,
    mssql,
    normalizeGroupedRows,
    pg,
} from '../../../src';
import {
    bucketGroup,
    buildIssueQuery,
    columnGroup,
    countAggregate,
    sumAggregate,
} from '../../data/grouped';

const PG_DAY = 'to_char(date_trunc(\'day\', "event"."createdAt"), \'YYYY-MM-DD"T"HH24:MI:SS".000Z"\')';

const pgFilters = () => new Adapter({ ...pg, rootAlias: 'event' }).filters;

class ZonedFiltersAdapter extends FiltersAdapter {
    override temporalKind(field: string) : TemporalKind | undefined {
        return field === 'createdAt' ? 'instant' : undefined;
    }
}

const zonedFilters = () => new ZonedFiltersAdapter(new RelationsAdapter(), { ...pg, rootAlias: 'event' });

describe('src/adapter/grouped/module.ts', () => {
    it('should build selects, repeated group expressions and the default group order', () => {
        expect(buildGroupedClauses(buildIssueQuery(), pgFilters(), pg.bucket)).toEqual({
            selects: [
                { key: 'bucket', expression: PG_DAY },
                { key: 'scope', expression: '"event"."scope"' },
                { key: 'name', expression: '"event"."name"' },
                { key: 'count', expression: 'count(*)' },
            ],
            groupBy: [PG_DAY, '"event"."scope"', '"event"."name"'],
            orderBy: [
                { key: 'bucket', direction: 'ASC' },
                { key: 'scope', direction: 'ASC' },
                { key: 'name', direction: 'ASC' },
            ],
        });
    });

    it('should order by the explicit sorts when present', () => {
        const query = new Query({
            groups: new Groups([columnGroup('scope')]),
            aggregates: new Aggregates([countAggregate()]),
            sorts: new Sorts([new Sort('count', 'DESC')]),
        });

        expect(buildGroupedClauses(query, pgFilters(), pg.bucket).orderBy).toEqual([
            { key: 'count', direction: 'DESC' },
        ]);
    });

    it('should refuse a sort that names no output key instead of rendering it', () => {
        const query = new Query({
            groups: new Groups([columnGroup('scope')]),
            sorts: new Sorts([new Sort('name', 'ASC')]),
        });

        expect(() => buildGroupedClauses(query, pgFilters(), pg.bucket))
            .toThrow('The feature sorts:grouped is not supported by the dialect.');
    });

    it('should build an aggregates-only query without group by or order', () => {
        const query = new Query({
            aggregates: new Aggregates([
                countAggregate(),
                countAggregate('couponId'),
                sumAggregate('amount'),
            ]),
        });

        expect(buildGroupedClauses(query, pgFilters(), pg.bucket)).toEqual({
            selects: [
                { key: 'count', expression: 'count(*)' },
                { key: 'count_couponId', expression: 'count("event"."couponId")' },
                { key: 'sum_amount', expression: 'sum("event"."amount")' },
            ],
            groupBy: [],
            orderBy: [],
        });
    });

    it('should pass the column kind to the bucket callback', () => {
        const query = new Query({ groups: new Groups([bucketGroup('hour')]) });

        expect(buildGroupedClauses(query, zonedFilters(), pg.bucket).groupBy).toEqual([
            'to_char(date_trunc(\'hour\', "event"."createdAt" at time zone \'UTC\'), \'YYYY-MM-DD"T"HH24:MI:SS".000Z"\')',
        ]);
    });

    it('should refuse a query without groups and aggregates', () => {
        expect(() => buildGroupedClauses(new Query(), pgFilters(), pg.bucket))
            .toThrow('The feature groups:empty is not supported by the dialect.');
    });

    it('should refuse a projection', () => {
        const query = new Query({
            fields: new Fields([new Field('id')]),
            aggregates: new Aggregates([countAggregate()]),
        });

        expect(() => buildGroupedClauses(query, pgFilters(), pg.bucket))
            .toThrow('The feature fields:grouped is not supported by the dialect.');
    });

    it('should refuse unresolved terms', () => {
        const groups = new Query({ groups: new Groups([new Group({ name: 'period', params: ['day'] })]) });
        expect(() => buildGroupedClauses(groups, pgFilters(), pg.bucket))
            .toThrow('The feature groups:unresolved is not supported by the dialect.');

        const aggregates = new Query({ aggregates: new Aggregates([new Aggregate({ name: 'total', params: ['amount'] })]) });
        expect(() => buildGroupedClauses(aggregates, pgFilters(), pg.bucket))
            .toThrow('The feature aggregates:unresolved is not supported by the dialect.');
    });

    it('should refuse functions it cannot lower', () => {
        const groups = new Query({
            groups: new Groups([new Group({
                name: 'week',
                params: ['createdAt'],
                lowering: {
                    fn: 'week', 
                    field: 'createdAt', 
                    args: [], 
                },
            })]),
        });
        expect(() => buildGroupedClauses(groups, pgFilters(), pg.bucket))
            .toThrow('The feature groups:week is not supported by the dialect.');

        const aggregates = new Query({
            aggregates: new Aggregates([new Aggregate({
                name: 'avg',
                params: ['amount'],
                lowering: {
                    fn: 'avg', 
                    field: 'amount', 
                    args: [], 
                },
            })]),
        });
        expect(() => buildGroupedClauses(aggregates, pgFilters(), pg.bucket))
            .toThrow('The feature aggregates:avg is not supported by the dialect.');
    });

    it('should refuse a bucket on a dialect without the callback', () => {
        const query = new Query({ groups: new Groups([bucketGroup('day')]) });
        const { filters } = new Adapter({ ...mssql, rootAlias: 'event' });

        expect(() => buildGroupedClauses(query, filters, mssql.bucket))
            .toThrow('The feature groups:bucket is not supported by the dialect.');
    });

    it('should refuse a bucket unit outside the enum instead of inlining it', () => {
        const query = new Query({ groups: new Groups([bucketGroup('day\') or 1=1 --')]) });

        expect(() => buildGroupedClauses(query, pgFilters(), pg.bucket))
            .toThrow('The value of the key bucket is invalid.');
    });

    it('should refuse a bucket on a column that is not temporal', () => {
        const query = new Query({ groups: new Groups([bucketGroup('day', 'amount')]) });

        expect(() => buildGroupedClauses(query, zonedFilters(), pg.bucket))
            .toThrow('The feature groups:bucket-type is not supported by the dialect.');
    });
});

describe('src/adapter/grouped/module.ts (normalizeGroupedRows)', () => {
    const query = new Query({
        groups: new Groups([bucketGroup('day'), columnGroup('scope')]),
        aggregates: new Aggregates([countAggregate(), sumAggregate('amount')]),
    });

    it('should read count and sum as numbers across driver representations', () => {
        const rows = normalizeGroupedRows(query, [
            // pg: count(*) is bigint and sum(numeric) a decimal, both as text
            {
                bucket: '2026-09-22T00:00:00.000Z', 
                scope: 'user', 
                count: '3', 
                sum_amount: '12.50',
            },
            // mysql: count is a number, sum a DECIMAL string
            {
                bucket: '2026-09-23T00:00:00.000Z', 
                scope: 'role', 
                count: 2, 
                sum_amount: '7.00',
            },
            // sqlite: numbers already
            {
                bucket: '2026-09-24T00:00:00.000Z', 
                scope: null, 
                count: 1, 
                sum_amount: 4,
            },
        ]);

        expect(rows).toEqual([
            {
                bucket: '2026-09-22T00:00:00.000Z', 
                scope: 'user', 
                count: 3, 
                sum_amount: 12.5,
            },
            {
                bucket: '2026-09-23T00:00:00.000Z', 
                scope: 'role', 
                count: 2, 
                sum_amount: 7,
            },
            {
                bucket: '2026-09-24T00:00:00.000Z', 
                scope: null, 
                count: 1, 
                sum_amount: 4,
            },
        ]);
    });

    it('should keep a sum over no values null', () => {
        const [row] = normalizeGroupedRows(query, [{
            bucket: '2026-09-22T00:00:00.000Z', 
            scope: 'user', 
            count: '0', 
            sum_amount: null,
        }]);

        expect(row).toEqual({
            bucket: '2026-09-22T00:00:00.000Z', 
            scope: 'user', 
            count: 0, 
            sum_amount: null,
        });
    });

    it('should copy only the output keys, in IR order', () => {
        const [row] = normalizeGroupedRows(query, [{
            sum_amount: 1, 
            extra: 'x', 
            count: 1, 
            scope: 'user', 
            bucket: '2026-09-22T00:00:00.000Z',
        }]);

        expect(Object.keys(row)).toEqual(['bucket', 'scope', 'count', 'sum_amount']);
    });
});
