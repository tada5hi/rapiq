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
} from '@rapiq/core';
import { applyGroupedQuery, compileGroupedQuery } from '../../../src';
import { column, count, grouped } from '../../data/calls';
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

        it('should count groups as the total and slice them by pagination', () => {
            const query = grouped([column('scope')], [count()], { pagination: new Pagination(2, 1) });

            expect(applyGroupedQuery(query, events)).toEqual({
                data: [{ scope: 'client', count: 1 }, { scope: 'user', count: 3 }],
                total: 4,
                pagination: { limit: 2, offset: 1 },
            });
        });

        it('should apply explicit sorts over output keys with a stable tie-break', () => {
            const query = grouped([column('scope')], [count()], { sorts: new Sorts([new Sort('count', SortDirection.DESC)]) });

            expect(applyGroupedQuery(query, events).data).toEqual([
                { scope: 'user', count: 3 },
                { scope: 'client', count: 1 },
                { scope: null, count: 1 },
                { scope: 'User', count: 1 },
            ]);
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
});
