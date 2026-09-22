/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AGGREGATE_FUNCTION_SLOTS,
    ErrorCode,
    ErrorMessage,
    GROUP_FUNCTION_SLOTS,
    SchemaError,
    describeCallFunctions,
    normalizeCallFunctions,
} from '../../../src';
import type { CallSlot, ObjectLiteral } from '../../../src';
import { captureError } from '../../data';

type InvalidCase = {
    primitives: Record<string, CallSlot[]>,
    input: Record<string, ObjectLiteral>,
    columns?: string[],
    name: string,
    reason: string,
};

describe('src/schema/parameter/call/*.ts', () => {
    it('should return an empty record for an undeclared block', () => {
        expect(normalizeCallFunctions(GROUP_FUNCTION_SLOTS, undefined)).toEqual({});
    });

    it('should normalize the built-in form with every slot open', () => {
        expect(normalizeCallFunctions(GROUP_FUNCTION_SLOTS, { bucket: { allowed: ['createdAt'] } })).toEqual({
            bucket: {
                fn: 'bucket',
                slots: [
                    {
                        name: 'field',
                        values: ['createdAt'],
                        fixed: false,
                        optional: false,
                    },
                    {
                        name: 'unit',
                        values: ['hour', 'day', 'month'],
                        fixed: false,
                        optional: false,
                    },
                ],
            },
        });

        expect(normalizeCallFunctions(AGGREGATE_FUNCTION_SLOTS, { count: {}, sum: { allowed: ['amount'] } })).toEqual({
            count: {
                fn: 'count',
                slots: [{
                    name: 'field',
                    values: [],
                    fixed: false,
                    optional: true,
                }],
            },
            sum: {
                fn: 'sum',
                slots: [{
                    name: 'field',
                    values: ['amount'],
                    fixed: false,
                    optional: false,
                }],
            },
        });
    });

    it('should bind a named function: a scalar fixes a slot, an array opens it', () => {
        expect(normalizeCallFunctions(GROUP_FUNCTION_SLOTS, {
            period: {
                fn: 'bucket',
                field: 'createdAt',
                unit: ['hour', 'day'],
            },
        })).toEqual({
            period: {
                fn: 'bucket',
                slots: [
                    {
                        name: 'field',
                        values: ['createdAt'],
                        fixed: true,
                        optional: false,
                    },
                    {
                        name: 'unit',
                        values: ['hour', 'day'],
                        fixed: false,
                        optional: false,
                    },
                ],
            },
        });

        expect(normalizeCallFunctions(AGGREGATE_FUNCTION_SLOTS, {
            total: { fn: 'sum', field: ['amount', 'fee'] },
            rows: { fn: 'count' },
        })).toEqual({
            total: {
                fn: 'sum',
                slots: [{
                    name: 'field',
                    values: ['amount', 'fee'],
                    fixed: false,
                    optional: false,
                }],
            },
            rows: { fn: 'count', slots: [] },
        });
    });

    it('should not alias the declared arrays', () => {
        const unit = ['hour', 'day'];
        const output = normalizeCallFunctions(GROUP_FUNCTION_SLOTS, {
            period: {
                fn: 'bucket',
                field: 'createdAt',
                unit,
            },
        });

        unit.push('month');

        expect(output.period!.slots[1]!.values).toEqual(['hour', 'day']);
    });

    it('should describe only the open slots, in wire order', () => {
        const functions = normalizeCallFunctions(AGGREGATE_FUNCTION_SLOTS, {
            count: { allowed: ['couponId'] },
            total: { fn: 'sum', field: ['amount', 'fee'] },
            revenue: { fn: 'sum', field: 'amount' },
        });

        expect(describeCallFunctions(functions)).toEqual({
            count: {
                fn: 'count',
                params: [{
                    name: 'field',
                    values: ['couponId'],
                    optional: true,
                }],
            },
            total: {
                fn: 'sum',
                params: [{
                    name: 'field',
                    values: ['amount', 'fee'],
                    optional: false,
                }],
            },
            revenue: { fn: 'sum', params: [] },
        });
    });

    const cases : InvalidCase[] = [
        {
            primitives: GROUP_FUNCTION_SLOTS,
            input: {
                'per-day': {
                    fn: 'bucket',
                    field: 'createdAt',
                    unit: 'day',
                },
            },
            name: 'per-day',
            reason: 'the name is not a valid identifier',
        },
        {
            primitives: GROUP_FUNCTION_SLOTS,
            input: {
                status: {
                    fn: 'bucket',
                    field: 'createdAt',
                    unit: 'day',
                },
            },
            columns: ['status'],
            name: 'status',
            reason: 'it shadows the column of the same name',
        },
        {
            primitives: GROUP_FUNCTION_SLOTS,
            input: { period: 'bucket' as unknown as ObjectLiteral },
            name: 'period',
            reason: 'the declaration is not an object',
        },
        {
            primitives: GROUP_FUNCTION_SLOTS,
            input: { bucket: { allowed: ['createdAt'], unit: 'day' } },
            name: 'bucket',
            reason: 'a built-in function takes only allowed',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            input: { sum: { allowed: 'amount' } },
            name: 'sum',
            reason: 'allowed is not an array',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            input: { sum: { allowed: ['realm.id'] } },
            name: 'sum',
            reason: 'the slot field value realm.id is invalid',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            input: { total: { fn: 'avg', field: 'amount' } },
            name: 'total',
            reason: 'fn must be one of count, sum',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            input: { total: { field: 'amount' } },
            name: 'total',
            reason: 'fn must be one of count, sum',
        },
        {
            primitives: GROUP_FUNCTION_SLOTS,
            input: { period: { fn: 'bucket', field: 'createdAt' } },
            name: 'period',
            reason: 'the slot unit is missing',
        },
        {
            primitives: GROUP_FUNCTION_SLOTS,
            input: {
                period: {
                    fn: 'bucket',
                    field: 'createdAt',
                    unit: 'day',
                    zone: 'UTC',
                },
            },
            name: 'period',
            reason: 'the slot zone is unknown',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            input: { total: { fn: 'sum', field: [] } },
            name: 'total',
            reason: 'the slot field is empty',
        },
        {
            primitives: GROUP_FUNCTION_SLOTS,
            input: {
                period: {
                    fn: 'bucket',
                    field: 'createdAt',
                    unit: 'week',
                },
            },
            name: 'period',
            reason: 'the slot unit value week is invalid',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            input: { total: { fn: 'sum', field: 'realm.id' } },
            name: 'total',
            reason: 'the slot field value realm.id is invalid',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            // parsed JSON carries __proto__ as an own key; a literal would not.
            input: JSON.parse('{"__proto__": {"fn": "sum", "field": "amount"}}'),
            name: '__proto__',
            reason: 'the name is not a valid identifier',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            input: { constructor: { fn: 'sum', field: 'amount' } },
            name: 'constructor',
            reason: 'the name is not a valid identifier',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            input: { sum: { allowed: ['amount', 'prototype'] } },
            name: 'sum',
            reason: 'the slot field value prototype is invalid',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            input: { total: { fn: 'sum', field: '__proto__' } },
            name: 'total',
            reason: 'the slot field value __proto__ is invalid',
        },
        {
            primitives: AGGREGATE_FUNCTION_SLOTS,
            input: { total: { fn: 'sum', field: ['amount', 'constructor'] } },
            name: 'total',
            reason: 'the slot field value constructor is invalid',
        },
    ];

    it.each(cases)('should refuse $name: $reason', ({
        primitives,
        input,
        columns,
        name,
        reason,
    }) => {
        const error = captureError<SchemaError>(() => normalizeCallFunctions(primitives, input, columns));

        expect(error).toBeInstanceOf(SchemaError);
        expect(error.code).toBe(ErrorCode.KEY_INVALID);
        expect(error.message).toBe(ErrorMessage.functionInvalid(name, reason));
    });
});
