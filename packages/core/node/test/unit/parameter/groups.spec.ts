/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { CallLowering } from '../../../src';
import {
    Aggregate,
    Aggregates,
    ErrorCode,
    Group,
    Groups,
    MergeError,
    isCallEqual,
} from '../../../src';

const bucketDay : CallLowering = {
    fn: 'bucket',
    field: 'createdAt',
    args: ['day'],
};
const scope : CallLowering = {
    fn: undefined,
    field: 'scope',
    args: [],
};
const count : CallLowering = {
    fn: 'count',
    field: undefined,
    args: [],
};

describe('src/parameter/groups/**', () => {
    it('should key a group by its column and keep the wire form', () => {
        const group = new Group({
            name: 'bucket',
            params: ['createdAt', 'day'],
            lowering: bucketDay,
        });

        expect(group.key).toEqual('createdAt');
        expect(group.name).toEqual('bucket');
        expect(group.params).toEqual(['createdAt', 'day']);
        expect(group.lowering).toEqual(bucketDay);
        expect(new Group({
            name: 'period',
            params: ['day'],
            lowering: bucketDay,
        }).key).toEqual('createdAt');
    });

    it('should default params to none and lowering to unresolved', () => {
        const group = new Group({ name: 'period' });

        expect(group.key).toEqual('period');
        expect(group.params).toEqual([]);
        expect(group.lowering).toBeUndefined();
    });

    it('should not share the params array with the caller', () => {
        const params = ['createdAt', 'day'];
        const group = new Group({ name: 'bucket', params });
        const aggregate = new Aggregate({ name: 'sum', params });
        params.push('hour');

        expect(group.params).toEqual(['createdAt', 'day']);
        expect(aggregate.params).toEqual(['createdAt', 'day']);
    });

    it('should default to an empty collection', () => {
        expect(new Groups().value).toEqual([]);
    });

    it('should return the other side when one side is empty', () => {
        const filled = new Groups([new Group({ name: 'scope', lowering: scope })]);

        expect(new Groups().merge(filled)).toBe(filled);
        expect(filled.merge(new Groups())).toBe(filled);
    });

    it('should keep the receiver when both sides declare the same grain', () => {
        const left = new Groups([
            new Group({
                name: 'bucket',
                params: ['createdAt', 'day'],
                lowering: bucketDay,
            }),
            new Group({ name: 'scope', lowering: scope }),
        ]);
        const right = new Groups([
            new Group({
                name: 'bucket',
                params: ['createdAt', 'day'],
                lowering: bucketDay,
            }),
            new Group({ name: 'scope', lowering: scope }),
        ]);

        expect(left.merge(right)).toBe(left);
    });

    it('should refuse to merge two different grains', () => {
        const left = new Groups([new Group({ name: 'scope', lowering: scope })]);
        const reordered = new Groups([
            new Group({
                name: 'name',
                lowering: {
                    fn: undefined,
                    field: 'name',
                    args: [],
                },
            }),
            new Group({ name: 'scope', lowering: scope }),
        ]);

        expect(() => left.merge(reordered)).toThrowError(MergeError);
        expect(() => left.merge(reordered)).toThrowError(expect.objectContaining({
            code: ErrorCode.KEY_AMBIGUOUS,
            message: 'Merging would combine two different groups definitions.',
        }));
    });
});

describe('src/parameter/aggregates/**', () => {
    it('should key an aggregate by its name followed by its params in camel case', () => {
        expect(new Aggregate({ name: 'count', lowering: count }).key).toEqual('count');
        expect(new Aggregate({ name: 'count', params: ['couponId'] }).key).toEqual('countCouponId');
        expect(new Aggregate({ name: 'sum', params: ['amount'] }).key).toEqual('sumAmount');
        expect(new Aggregate({ name: 'sum', params: ['total_amount'] }).key).toEqual('sumTotalAmount');
        expect(new Aggregate({ name: 'total', params: ['fee'] }).key).toEqual('totalFee');
        expect(new Aggregate({ name: 'total' }).key).toEqual('total');
    });

    it('should merge by the same rule as groups', () => {
        const left = new Aggregates([new Aggregate({ name: 'count', lowering: count })]);
        const same = new Aggregates([new Aggregate({ name: 'count', lowering: count })]);
        const other = new Aggregates([
            new Aggregate({
                name: 'sum',
                params: ['amount'],
                lowering: {
                    fn: 'sum',
                    field: 'amount',
                    args: [],
                },
            }),
        ]);

        expect(new Aggregates().merge(left)).toBe(left);
        expect(left.merge(new Aggregates())).toBe(left);
        expect(left.merge(same)).toBe(left);
        expect(() => left.merge(other)).toThrowError(expect.objectContaining({
            code: ErrorCode.KEY_AMBIGUOUS,
            message: 'Merging would combine two different aggregates definitions.',
        }));
    });
});

describe('src/parameter/call/module.ts', () => {
    it('should compare name, params and lowering', () => {
        const a = new Group({
            name: 'bucket',
            params: ['createdAt', 'day'],
            lowering: bucketDay,
        });

        expect(isCallEqual(a, new Group({
            name: 'bucket',
            params: ['createdAt', 'day'],
            lowering: { ...bucketDay },
        }))).toBe(true);
        expect(isCallEqual(a, new Group({
            name: 'bucket',
            params: ['createdAt', 'hour'],
            lowering: bucketDay,
        }))).toBe(false);
        expect(isCallEqual(a, new Group({
            name: 'bucket',
            params: ['createdAt', 'day'],
            lowering: { ...bucketDay, args: ['hour'] },
        }))).toBe(false);
        expect(isCallEqual(a, new Group({
            name: 'bucket',
            params: ['createdAt', 'day'],
            lowering: { ...bucketDay, field: 'updatedAt' },
        }))).toBe(false);
    });

    it('should tell an unresolved call from a resolved one', () => {
        const unresolved = new Group({ name: 'period', params: ['day'] });
        const resolved = new Group({
            name: 'period',
            params: ['day'],
            lowering: bucketDay,
        });

        expect(isCallEqual(unresolved, new Group({ name: 'period', params: ['day'] }))).toBe(true);
        expect(isCallEqual(unresolved, resolved)).toBe(false);
        expect(isCallEqual(resolved, unresolved)).toBe(false);
    });
});
