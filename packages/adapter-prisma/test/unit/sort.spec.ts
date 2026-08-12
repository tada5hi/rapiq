/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    ErrorCode,
    Pagination,
    Query,
    Sort,
    SortDirection,
    Sorts,
} from '@rapiq/core';
import { createAdapterOptions } from '../data/schema';
import { PrismaAdapter } from '../../src';

function orderBy(sorts: Sorts) {
    return new PrismaAdapter(createAdapterOptions()).execute(new Query({ sorts })).args.orderBy;
}

describe('src/adapter/sort.ts', () => {
    it('should emit nothing without sorts', () => {
        expect(orderBy(new Sorts())).toBeUndefined();
    });

    it('should emit an array of single-key objects', () => {
        // a multi-key object is rejected by prisma and would lose the
        // order of the keys anyway.
        expect(orderBy(new Sorts([
            new Sort('age', SortDirection.DESC),
            new Sort('first_name', SortDirection.ASC),
        ]))).toEqual([
            { age: 'desc' },
            { first_name: 'asc' },
        ]);
    });

    it('should default to ascending', () => {
        expect(orderBy(new Sorts([new Sort('id')]))).toEqual([{ id: 'asc' }]);
    });

    it('should nest a relation path', () => {
        expect(orderBy(new Sorts([
            new Sort('realm.name', SortDirection.DESC),
        ]))).toEqual([{ realm: { name: 'desc' } }]);
    });

    it('should keep the first occurrence of a duplicated key', () => {
        expect(orderBy(new Sorts([
            new Sort('id', SortDirection.DESC),
            new Sort('id', SortDirection.ASC),
        ]))).toEqual([{ id: 'desc' }]);
    });

    // A7 (plan 032): parity with @rapiq/adapter-drizzle's typed refusal —
    // prisma cannot order by a to-many relation's field (only `_count`
    // is available there), so the illegal input fails typed here instead
    // of reaching prisma as a non-rapiq validation error.
    describe('to-many relation paths (A7)', () => {
        it('throws a typed featureUnsupported(sorts:relation) error for a to-many relation path', () => {
            try {
                orderBy(new Sorts([new Sort('items.title', SortDirection.ASC)]));
                expect.fail('sorting by a to-many relation path must throw');
            } catch (e) {
                expect(e).toBeInstanceOf(AdapterError);
                expect((e as AdapterError).code).toEqual(ErrorCode.FEATURE_UNSUPPORTED);
                expect((e as AdapterError).feature).toEqual('sorts:relation');
            }
        });

        it('still allows ordering by a to-one relation path', () => {
            expect(orderBy(new Sorts([
                new Sort('realm.name', SortDirection.DESC),
            ]))).toEqual([{ realm: { name: 'desc' } }]);
        });
    });
});

describe('src/adapter/pagination.ts', () => {
    const build = (pagination: Pagination) => new PrismaAdapter(createAdapterOptions())
        .execute(new Query({ pagination }));

    it('should emit nothing without pagination', () => {
        const { args, pagination } = build(new Pagination());

        expect(args).toEqual({});
        expect(pagination).toEqual({ limit: undefined, offset: undefined });
    });

    it('should render take and skip', () => {
        expect(build(new Pagination(10, 20)).args).toEqual({ take: 10, skip: 20 });
    });

    it('should render an explicit zero', () => {
        expect(build(new Pagination(0, 0)).args).toEqual({ take: 0, skip: 0 });
    });

    it('should render a limit without an offset', () => {
        expect(build(new Pagination(10)).args).toEqual({ take: 10 });
    });
});
