/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Aggregate,
    ErrorCode,
    Field,
    Fields,
    Group,
    Pagination,
    Query,
    Relation,
    Relations,
    Sort,
    SortDirection,
    Sorts,
    eq,
    inArray,
} from '@rapiq/core';
import { applyGroupedQuery, compileGroupedQuery } from '../../../src';
import {
    bucket,
    column,
    count,
    grouped,
    sum,
} from '../../data/calls';
import { events } from '../../data/event';

function unsupported(feature: string) {
    return expect.objectContaining({ code: ErrorCode.FEATURE_UNSUPPORTED, feature });
}

describe('src/grouped/module.ts', () => {
    describe('refusals', () => {
        it('should refuse a query without groups or aggregates', () => {
            expect(() => compileGroupedQuery(new Query())).toThrowError(unsupported('groups:empty'));
        });

        it('should refuse a fields parameter', () => {
            const query = grouped([column('scope')], [count()], { fields: new Fields([new Field('id')]) });

            expect(() => compileGroupedQuery(query)).toThrowError(unsupported('fields:grouped'));
        });

        it('should refuse an output key written twice by a hand-built query', () => {
            const query = grouped([column('count')], [count()]);

            expect(() => compileGroupedQuery(query)).toThrowError(expect.objectContaining({ code: ErrorCode.KEY_AMBIGUOUS }));
        });

        it('should refuse an unresolved call', () => {
            const group = new Group({ name: 'period', params: ['day'] });
            expect(() => compileGroupedQuery(grouped([group], []))).toThrowError(unsupported('groups:unresolved'));

            const aggregate = new Aggregate({ name: 'total', params: ['amount'] });
            expect(() => compileGroupedQuery(grouped([], [aggregate]))).toThrowError(unsupported('aggregates:unresolved'));
        });

        it('should refuse an unknown function', () => {
            const group = new Group({
                name: 'week',
                params: ['createdAt'],
                lowering: {
                    fn: 'week',
                    field: 'createdAt',
                    args: [],
                },
            });
            expect(() => compileGroupedQuery(grouped([group], []))).toThrowError(unsupported('groups:week'));

            const aggregate = new Aggregate({
                name: 'avg',
                params: ['amount'],
                lowering: {
                    fn: 'avg',
                    field: 'amount',
                    args: [],
                },
            });
            expect(() => compileGroupedQuery(grouped([], [aggregate]))).toThrowError(unsupported('aggregates:avg'));
        });

        it('should refuse a sort that names no output key', () => {
            const query = grouped([column('scope')], [count()], { sorts: new Sorts([new Sort('name', SortDirection.ASC)]) });

            expect(() => compileGroupedQuery(query)).toThrowError(unsupported('sorts:grouped'));
        });
    });

    describe('bare columns', () => {
        it('should count rows per group, null being its own group sorted last', () => {
            const output = applyGroupedQuery(grouped([column('scope')], [count()]), events);

            expect(output.data).toEqual([
                { scope: 'User', count: 1 },
                { scope: 'client', count: 1 },
                { scope: 'user', count: 3 },
                { scope: null, count: 1 },
            ]);
            expect(output.total).toEqual(4);
        });

        it('should group by the tuple of every group key', () => {
            const output = applyGroupedQuery(grouped([column('scope'), column('name')], [count()]), events);

            expect(output.data).toEqual([
                {
                    scope: 'User',
                    name: 'login',
                    count: 1,
                },
                {
                    scope: 'client',
                    name: 'login',
                    count: 1,
                },
                {
                    scope: 'user',
                    name: 'login',
                    count: 2,
                },
                {
                    scope: 'user',
                    name: 'logout',
                    count: 1,
                },
                {
                    scope: null,
                    name: 'login',
                    count: 1,
                },
            ]);
        });

        it('should keep values of different types apart and dates together by instant', () => {
            expect(applyGroupedQuery(grouped([column('v')], [count()]), [{ v: 1 }, { v: '1' }, { v: 1 }]).data)
                .toEqual([{ v: 1, count: 2 }, { v: '1', count: 1 }]);

            const instant = Date.UTC(2026, 8, 22);
            expect(applyGroupedQuery(grouped([column('d')], [count()]), [{ d: new Date(instant) }, { d: new Date(instant) }]).data)
                .toEqual([{ d: new Date(instant), count: 2 }]);
        });

        it('should group bigint values, apart from their string spelling', () => {
            const { data } = applyGroupedQuery(grouped([column('v')], [count()]), [{ v: 1n }, { v: '1' }, { v: 1n }, { v: 2n }]);

            expect(data).toHaveLength(3);
            expect(data).toEqual(expect.arrayContaining([
                { v: 1n, count: 2 },
                { v: '1', count: 1 },
                { v: 2n, count: 1 },
            ]));
        });

        it('should count groups as the total and slice them by pagination', () => {
            const query = grouped([column('scope')], [count()], { pagination: new Pagination(2, 1) });

            expect(applyGroupedQuery(query, events)).toEqual({
                data: [{ scope: 'client', count: 1 }, { scope: 'user', count: 3 }],
                total: 4,
                pagination: { limit: 2, offset: 1 },
            });
        });

        it('should apply explicit sorts over output keys, then break ties by the group keys ascending', () => {
            const query = grouped([column('scope')], [count()], { sorts: new Sorts([new Sort('count', SortDirection.DESC)]) });

            expect(applyGroupedQuery(query, events).data).toEqual([
                { scope: 'user', count: 3 },
                { scope: 'User', count: 1 },
                { scope: 'client', count: 1 },
                { scope: null, count: 1 },
            ]);
        });

        it('should page over ties without repeating or skipping a group', () => {
            const sorts = new Sorts([new Sort('count', SortDirection.DESC)]);
            const page = (offset: number) => applyGroupedQuery(
                grouped([column('scope')], [count()], { sorts, pagination: new Pagination(2, offset) }),
                [...events].reverse(),
            ).data;

            expect([...page(0), ...page(2)]).toEqual(applyGroupedQuery(
                grouped([column('scope')], [count()], { sorts }),
                events,
            ).data);
        });


        it('should filter records before grouping, honouring caseSensitive', () => {
            const query = grouped([column('scope')], [count()], { filters: eq('scope', 'user') });

            expect(applyGroupedQuery(query, events).data).toEqual([
                { scope: 'User', count: 1 },
                { scope: 'user', count: 3 },
            ]);
            expect(applyGroupedQuery(query, events, { caseSensitive: ['scope'] }).data).toEqual([
                { scope: 'user', count: 3 },
            ]);
        });

        it('should ignore relations', () => {
            const query = grouped([column('scope')], [count()], {
                relations: new Relations([new Relation('realm')]),
                filters: eq('realmId', 'r1'),
            });

            expect(applyGroupedQuery(query, events).data).toEqual([
                { scope: 'client', count: 1 },
                { scope: 'user', count: 3 },
            ]);
        });
    });

    describe('bucket', () => {
        it('should truncate to the UTC hour', () => {
            expect(applyGroupedQuery(grouped([bucket('createdAt', 'hour')], [count()]), events).data).toEqual([
                { createdAt: '2026-08-31T23:00:00.000Z', count: 1 },
                { createdAt: '2026-09-21T23:00:00.000Z', count: 1 },
                { createdAt: '2026-09-22T00:00:00.000Z', count: 1 },
                { createdAt: '2026-09-22T10:00:00.000Z', count: 2 },
                { createdAt: null, count: 1 },
            ]);
        });

        it('should truncate to the UTC day, whatever offset the value carries', () => {
            expect(applyGroupedQuery(grouped([bucket('createdAt', 'day')], [count()]), events).data).toEqual([
                { createdAt: '2026-08-31T00:00:00.000Z', count: 1 },
                { createdAt: '2026-09-21T00:00:00.000Z', count: 1 },
                { createdAt: '2026-09-22T00:00:00.000Z', count: 3 },
                { createdAt: null, count: 1 },
            ]);
        });

        it('should truncate to the UTC month', () => {
            expect(applyGroupedQuery(grouped([bucket('createdAt', 'month')], [count()]), events).data).toEqual([
                { createdAt: '2026-08-01T00:00:00.000Z', count: 1 },
                { createdAt: '2026-09-01T00:00:00.000Z', count: 4 },
                { createdAt: null, count: 1 },
            ]);
        });

        it('should read epoch milliseconds and plain dates, and put a value denoting no instant into the null bucket', () => {
            const data = [
                { createdAt: 'yesterday' },
                { createdAt: '2026-02-30' },
                { createdAt: Date.UTC(2026, 8, 22, 5) },
                { createdAt: '2026-09-22' },
            ];

            expect(applyGroupedQuery(grouped([bucket('createdAt', 'day')], [count()]), data).data).toEqual([
                { createdAt: '2026-09-22T00:00:00.000Z', count: 2 },
                { createdAt: null, count: 2 },
            ]);
        });

        it('should answer the issue request with one row per bucket, scope and name', () => {
            const query = grouped([bucket('createdAt', 'day'), column('scope'), column('name')], [count()], { filters: inArray('realmId', ['r1', null]) });

            expect(applyGroupedQuery(query, events).data).toEqual([
                {
                    createdAt: '2026-09-21T00:00:00.000Z',
                    scope: 'user',
                    name: 'login',
                    count: 1,
                },
                {
                    createdAt: '2026-09-22T00:00:00.000Z',
                    scope: 'client',
                    name: 'login',
                    count: 1,
                },
                {
                    createdAt: '2026-09-22T00:00:00.000Z',
                    scope: 'user',
                    name: 'login',
                    count: 1,
                },
                {
                    createdAt: '2026-09-22T00:00:00.000Z',
                    scope: 'user',
                    name: 'logout',
                    count: 1,
                },
                {
                    createdAt: null,
                    scope: null,
                    name: 'login',
                    count: 1,
                },
            ]);
        });

        it('should key a named bucket by its name', () => {
            const period = new Group({
                name: 'period',
                params: ['month'],
                lowering: {
                    fn: 'bucket',
                    field: 'createdAt',
                    args: ['month'],
                },
            });

            expect(applyGroupedQuery(grouped([period], [count()]), events).data[0])
                .toEqual({ period: '2026-08-01T00:00:00.000Z', count: 1 });
        });

        it('should refuse a unit outside the closed set, as adapter-sql does', () => {
            const week = new Group({
                name: 'bucket',
                params: ['createdAt', 'week'],
                lowering: {
                    fn: 'bucket',
                    field: 'createdAt',
                    args: ['week'],
                },
            });

            expect(() => compileGroupedQuery(grouped([week], [])))
                .toThrowError(expect.objectContaining({
                    code: ErrorCode.KEY_VALUE_INVALID,
                    message: 'The value of the key bucket(createdAt,week) is invalid.',
                }));
        });
    });

    describe('aggregates', () => {
        it('should count rows, count non-null values and sum per group', () => {
            const query = grouped([column('scope')], [count(), count('amount'), sum('amount')]);

            expect(applyGroupedQuery(query, events).data).toEqual([
                {
                    scope: 'User',
                    count: 1,
                    countAmount: 1,
                    sumAmount: 1,
                },
                {
                    scope: 'client',
                    count: 1,
                    countAmount: 1,
                    sumAmount: 2.5,
                },
                {
                    scope: 'user',
                    count: 3,
                    countAmount: 2,
                    sumAmount: 15,
                },
                {
                    scope: null,
                    count: 1,
                    countAmount: 1,
                    sumAmount: 7,
                },
            ]);
        });

        it('should sum numbers, bigints and numeric strings like the SQL row normalization', () => {
            const data = [
                // a typeorm decimal column hydrates as a string, a pg
                // bigint as a string or a bigint.
                { scope: 'a', amount: 1 },
                { scope: 'a', amount: '1.5' },
                { scope: 'a', amount: 2n },
                { scope: 'a', amount: ' 3 ' },
                { scope: 'a', amount: '1e1' },
            ];

            expect(applyGroupedQuery(grouped([column('scope')], [sum('amount')]), data).data).toEqual([
                { scope: 'a', sumAmount: 17.5 },
            ]);
        });

        it('should skip values that read as no finite number and answer null when there are none', () => {
            const data = [
                { scope: 'a', amount: null },
                { scope: 'a', amount: '' },
                { scope: 'a', amount: '  ' },
                { scope: 'a', amount: 'abc' },
                { scope: 'a', amount: 'Infinity' },
                { scope: 'a', amount: true },
                { scope: 'a', amount: new Date(0) },
                { scope: 'b', amount: NaN },
                { scope: 'b', amount: Infinity },
                { scope: 'c', amount: 'abc' },
                { scope: 'c', amount: '4' },
            ];

            expect(applyGroupedQuery(grouped([column('scope')], [sum('amount')]), data).data).toEqual([
                { scope: 'a', sumAmount: null },
                { scope: 'b', sumAmount: null },
                { scope: 'c', sumAmount: 4 },
            ]);
        });

        it('should answer exactly one row without groups', () => {
            const query = grouped([], [count(), sum('amount')]);

            expect(applyGroupedQuery(query, events)).toEqual({
                data: [{ count: 6, sumAmount: 25.5 }],
                total: 1,
                pagination: { limit: undefined, offset: undefined },
            });
        });

        it('should answer one row without groups even over zero records', () => {
            const query = grouped([], [count(), sum('amount')], { filters: eq('realmId', 'none') });

            expect(applyGroupedQuery(query, events).data).toEqual([{ count: 0, sumAmount: null }]);
            expect(applyGroupedQuery(grouped([], [count()]), []).total).toEqual(1);
        });

        it('should answer zero rows with groups over zero records', () => {
            expect(applyGroupedQuery(grouped([column('scope')], [count()]), [])).toEqual({
                data: [],
                total: 0,
                pagination: { limit: undefined, offset: undefined },
            });
        });

        it('should compose a bucket with every aggregate', () => {
            const query = grouped([bucket('createdAt', 'month')], [count(), sum('amount')]);

            expect(applyGroupedQuery(query, events).data).toEqual([
                {
                    createdAt: '2026-08-01T00:00:00.000Z',
                    count: 1,
                    sumAmount: 1,
                },
                {
                    createdAt: '2026-09-01T00:00:00.000Z',
                    count: 4,
                    sumAmount: 17.5,
                },
                {
                    createdAt: null,
                    count: 1,
                    sumAmount: 7,
                },
            ]);
        });
    });
});
