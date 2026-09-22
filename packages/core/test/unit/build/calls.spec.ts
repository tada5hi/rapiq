/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BuildError,
    ErrorCode,
    ErrorMessage,
    Group,
    Groups,
    Sort,
    SortDirection,
    defineAggregates,
    defineGroups,
    defineQuery,
} from '../../../src';
import { captureError } from '../../data';
import type { Order } from '../../data';

describe('src/build/parameter/{groups,aggregates}/*.ts', () => {
    it('should resolve primitives and bare columns against the built-in table', () => {
        const groups = defineGroups<Order>([{ name: 'bucket', params: ['createdAt', 'day'] }, 'status']);

        expect(groups.value.map((item) => item.key)).toEqual(['bucket', 'status']);
        expect(groups.value.map((item) => item.lowering)).toEqual([
            {
                fn: 'bucket',
                field: 'createdAt',
                args: ['day'],
            },
            {
                fn: undefined,
                field: 'status',
                args: [],
            },
        ]);
    });

    it('should carry a named function unresolved, in its wire form', () => {
        const groups = defineGroups([{ name: 'period', params: ['day'] }]);
        const aggregates = defineAggregates([{ name: 'total', params: ['amount'] }]);

        expect(groups.value[0]!.name).toBe('period');
        expect(groups.value[0]!.params).toEqual(['day']);
        expect(groups.value[0]!.lowering).toBeUndefined();
        expect(aggregates.value[0]!.key).toBe('total_amount');
        expect(aggregates.value[0]!.lowering).toBeUndefined();
    });

    it('should key aggregates per column', () => {
        const aggregates = defineAggregates(['count', { name: 'sum', params: ['amount'] }, { name: 'sum', params: ['fee'] }]);

        expect(aggregates.value.map((item) => item.key)).toEqual(['count', 'sum_amount', 'sum_fee']);
        expect(aggregates.value[0]!.lowering).toEqual({
            fn: 'count',
            field: undefined,
            args: [],
        });
    });

    it('should pass built nodes through', () => {
        const group = new Group({
            name: 'status',
            lowering: {
                fn: undefined,
                field: 'status',
                args: [],
            },
        });
        const groups = new Groups([group]);

        expect(defineGroups(groups)).toBe(groups);
        expect(defineGroups([group]).value[0]).toBe(group);
    });

    it('should refuse an invalid identifier', () => {
        const error = captureError<BuildError>(() => defineGroups(['realm.name']));

        expect(error).toBeInstanceOf(BuildError);
        expect(error.code).toBe(ErrorCode.KEY_INVALID);
        expect(error.message).toBe(ErrorMessage.keyInvalid('realm.name'));
    });

    it.each(['__proto__', 'constructor', 'prototype'])('should refuse the reserved identifier %s', (name) => {
        for (const run of [
            () => defineGroups([name]),
            () => defineAggregates([{ name: 'sum', params: [name] }]),
        ]) {
            const error = captureError<BuildError>(run);

            expect(error).toBeInstanceOf(BuildError);
            expect(error.code).toBe(ErrorCode.KEY_INVALID);
            expect(error.message).toBe(ErrorMessage.keyInvalid(name));
        }
    });

    it('should refuse arguments a primitive does not take', () => {
        const error = captureError<BuildError>(() => defineAggregates([{ name: 'sum', params: ['amount', 'fee'] }]));

        expect(error.code).toBe(ErrorCode.KEY_VALUE_INVALID);
        expect(error.message).toBe(ErrorMessage.keyValueInvalid('sum'));
    });

    it('should refuse input of the wrong shape', () => {
        expect(captureError<BuildError>(() => defineGroups('status' as any)).code).toBe(ErrorCode.INPUT_INVALID);
        expect(captureError<BuildError>(() => defineAggregates([42] as any)).code).toBe(ErrorCode.INPUT_INVALID);
        expect(captureError<BuildError>(() => defineAggregates([{ name: 'sum', params: [1] }] as any)).code)
            .toBe(ErrorCode.INPUT_INVALID);
    });

    it('should refuse a built node of another parameter', () => {
        const aggregates = defineAggregates(['count']);
        const group = defineGroups(['status']);
        const sort = new Sort('status', SortDirection.ASC);

        expect(captureError<BuildError>(() => defineGroups(aggregates as any)).code).toBe(ErrorCode.INPUT_INVALID);
        expect(captureError<BuildError>(() => defineGroups([sort] as any)).code).toBe(ErrorCode.INPUT_INVALID);
        expect(captureError<BuildError>(() => defineAggregates(group as any)).code).toBe(ErrorCode.INPUT_INVALID);
        expect(captureError<BuildError>(() => defineAggregates([group.value[0]] as any)).code)
            .toBe(ErrorCode.INPUT_INVALID);
    });

    it('should refuse a key requested twice within a parameter', () => {
        const groups = captureError<BuildError>(() => defineGroups([
            { name: 'bucket', params: ['createdAt', 'day'] },
            { name: 'bucket', params: ['createdAt', 'hour'] },
        ]));
        const aggregates = captureError<BuildError>(() => defineAggregates(['count', { name: 'count' }]));

        expect(groups.code).toBe(ErrorCode.KEY_AMBIGUOUS);
        expect(groups.message).toBe(ErrorMessage.outputKeyDuplicate('bucket'));
        expect(aggregates.code).toBe(ErrorCode.KEY_AMBIGUOUS);
        expect(aggregates.message).toBe(ErrorMessage.outputKeyDuplicate('count'));
    });
});

describe('src/build/module.ts', () => {
    it('should build a grouped query', () => {
        const query = defineQuery<Order>({
            groups: [{ name: 'bucket', params: ['createdAt', 'day'] }, 'status'],
            aggregates: ['count'],
        });

        expect(query.groups.value.map((item) => item.key)).toEqual(['bucket', 'status']);
        expect(query.aggregates.value.map((item) => item.key)).toEqual(['count']);
    });

    it('should accept both keys', () => {
        expect(() => defineQuery({ groups: [], aggregates: [] })).not.toThrow();
    });

    it('should refuse an aggregate key equal to a group key', () => {
        const error = captureError<BuildError>(() => defineQuery({ groups: ['count'], aggregates: ['count'] }));

        expect(error.code).toBe(ErrorCode.KEY_AMBIGUOUS);
        expect(error.message).toBe(ErrorMessage.outputKeyDuplicate('count'));
    });
});
