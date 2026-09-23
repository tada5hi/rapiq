/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AggregatesSchema,
    ErrorCode,
    ErrorMessage,
    GroupsSchema,
    SchemaError,
    defineAggregatesSchema,
    defineGroupsSchema,
} from '../../../src';
import { captureError } from '../../data';
import type { Order } from '../../data';

describe('src/schema/parameter/groups/*.ts', () => {
    it('should normalize the declared columns and functions', () => {
        const schema = defineGroupsSchema<Order>({
            allowed: ['status'],
            functions: {
                period: {
                    fn: 'bucket',
                    field: 'createdAt',
                    unit: ['hour', 'day'],
                },
            },
        });

        expect(schema).toBeInstanceOf(GroupsSchema);
        expect(schema.allowed).toEqual(['status']);
        expect(schema.allowedIsUndefined).toBe(false);
        expect(schema.functions).toEqual({
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
        expect(schema.functionsIsUndefined).toBe(false);
    });

    it('should permit nothing when nothing is declared', () => {
        const schema = defineGroupsSchema();

        expect(schema.allowed).toEqual([]);
        expect(schema.allowedIsUndefined).toBe(true);
        expect(schema.functions).toEqual({});
        expect(schema.functionsIsUndefined).toBe(true);
        expect(schema.describe()).toEqual({ allowed: null, functions: null });
    });

    it('should describe the columns and the open slots of each function', () => {
        const schema = defineGroupsSchema<Order>({
            allowed: ['status'],
            functions: {
                bucket: { allowed: ['createdAt'] },
                period: {
                    fn: 'bucket',
                    field: 'createdAt',
                    unit: ['hour', 'day'],
                },
            },
        });

        expect(schema.describe()).toEqual({
            allowed: ['status'],
            functions: {
                bucket: {
                    fn: 'bucket',
                    params: [
                        {
                            name: 'field',
                            values: ['createdAt'],
                            optional: false,
                        },
                        {
                            name: 'unit',
                            values: ['hour', 'day', 'month'],
                            optional: false,
                        },
                    ],
                },
                period: {
                    fn: 'bucket',
                    params: [{
                        name: 'unit',
                        values: ['hour', 'day'],
                        optional: false,
                    }],
                },
            },
        });
    });

    it('should not expose internal state to description mutations', () => {
        const schema = defineGroupsSchema<Order>({
            allowed: ['status'],
            functions: { bucket: { allowed: ['createdAt'] } },
        });

        const output = schema.describe();
        output.allowed!.push('mutated');
        output.functions!.bucket!.params[0]!.values.push('mutated');

        expect(schema.allowed).toEqual(['status']);
        expect(schema.functions.bucket!.slots[0]!.values).toEqual(['createdAt']);
    });

    it('should refuse an unknown option key', () => {
        const error = captureError<SchemaError>(() => defineGroupsSchema({ default: ['status'] } as any));

        expect(error).toBeInstanceOf(SchemaError);
        expect(error.code).toBe(ErrorCode.KEY_UNKNOWN);
    });

    it('should refuse a column that is not a valid identifier', () => {
        const error = captureError<SchemaError>(() => defineGroupsSchema({ allowed: ['realm.id'] }));

        expect(error).toBeInstanceOf(SchemaError);
        expect(error.code).toBe(ErrorCode.KEY_INVALID);
        expect(error.message).toBe(ErrorMessage.functionInvalid('realm.id', 'the column is not a valid identifier'));
    });

    it.each(['__proto__', 'constructor', 'prototype'])('should refuse the reserved column %s', (column) => {
        const error = captureError<SchemaError>(() => defineGroupsSchema({ allowed: [column] }));

        expect(error).toBeInstanceOf(SchemaError);
        expect(error.code).toBe(ErrorCode.KEY_INVALID);
        expect(error.message).toBe(ErrorMessage.functionInvalid(column, 'the column is not a valid identifier'));
    });

    it('should refuse columns that are not an array', () => {
        const error = captureError<SchemaError>(() => defineGroupsSchema({ allowed: 'status' } as any));

        expect(error).toBeInstanceOf(SchemaError);
        expect(error.code).toBe(ErrorCode.KEY_INVALID);
        expect(error.message).toBe(ErrorMessage.functionInvalid('allowed', 'allowed is not an array'));
    });

    it('should not share the declared columns with the caller', () => {
        const allowed = ['status'];
        const schema = defineGroupsSchema({ allowed });
        allowed.push('scope');

        expect(schema.allowed).toEqual(['status']);
    });

    it('should refuse a function shadowing a column', () => {
        const error = captureError<SchemaError>(() => defineGroupsSchema<Order>({
            allowed: ['status'],
            functions: {
                status: {
                    fn: 'bucket',
                    field: 'createdAt',
                    unit: 'day',
                },
            },
        }));

        expect(error.code).toBe(ErrorCode.KEY_INVALID);
        expect(error.message).toBe(ErrorMessage.functionInvalid('status', 'it shadows the column of the same name'));
    });
});

describe('src/schema/parameter/aggregates/*.ts', () => {
    it('should normalize and describe the declared functions', () => {
        const schema = defineAggregatesSchema<Order>({
            functions: {
                count: { allowed: ['couponId'] },
                total: { fn: 'sum', field: ['amount', 'fee'] },
                revenue: { fn: 'sum', field: 'amount' },
            },
        });

        expect(schema).toBeInstanceOf(AggregatesSchema);
        expect(schema.functionsIsUndefined).toBe(false);
        expect(Object.keys(schema.functions)).toEqual(['count', 'total', 'revenue']);
        expect(schema.describe()).toEqual({
            functions: {
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
            },
        });
    });

    it('should permit nothing when nothing is declared', () => {
        const schema = defineAggregatesSchema();

        expect(schema.functions).toEqual({});
        expect(schema.functionsIsUndefined).toBe(true);
        expect(schema.describe()).toEqual({ functions: null });
    });

    it('should refuse the columns option, which aggregates do not have', () => {
        const error = captureError<SchemaError>(() => defineAggregatesSchema({ allowed: ['amount'] } as any));

        expect(error).toBeInstanceOf(SchemaError);
        expect(error.code).toBe(ErrorCode.KEY_UNKNOWN);
    });

    it('should refuse a named aggregate without a primitive', () => {
        const error = captureError<SchemaError>(() => defineAggregatesSchema({ functions: { total: { field: 'amount' } as any } }));

        expect(error.message).toBe(ErrorMessage.functionInvalid('total', 'fn must be one of count, sum'));
    });
});
