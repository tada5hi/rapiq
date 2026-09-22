/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition } from '@rapiq/core';
import {
    AdapterError,
    ErrorCode,
    FilterCompoundOperator,
    Filters,
    Query,
    eq,
    gte,
    inArray,
    ne,
} from '@rapiq/core';
import { PrismaAdapter } from '../../src';
import { createAdapterOptions } from '../data/schema';

const INSTANT = '2026-08-23T10:16:44.000Z';

function build(condition: Condition) {
    const adapter = new PrismaAdapter(createAdapterOptions());
    const { args } = adapter.execute(new Query({ filters: new Filters(FilterCompoundOperator.AND, [condition]) }));

    return args.where;
}

describe('src/adapter/where.ts (date fields)', () => {
    it('should bind a wire string as a date instance', () => {
        expect(build(gte('created_at', INSTANT)))
            .toEqual({ created_at: { gte: new Date(INSTANT) } });
    });

    it('should bind equality operands', () => {
        expect(build(eq('created_at', INSTANT)))
            .toEqual({ created_at: { equals: new Date(INSTANT) } });
    });

    it('should bind every member of a list', () => {
        expect(build(inArray('created_at', [INSTANT, '2026-08-22T10:16:44.000Z'])))
            .toEqual({ created_at: { in: [new Date(INSTANT), new Date('2026-08-22T10:16:44.000Z')] } });
    });

    it('should bind the operand of a negated comparison', () => {
        expect(build(ne('created_at', INSTANT)))
            .toEqual({
                OR: [
                    { created_at: { not: new Date(INSTANT) } },
                    { created_at: null },
                ],
            });
    });

    it('should read an epoch timestamp in milliseconds', () => {
        expect(build(eq('created_at', Date.parse(INSTANT))))
            .toEqual({ created_at: { equals: new Date(INSTANT) } });
    });

    it('should leave a non-date field untouched', () => {
        expect(build(eq('address', INSTANT)))
            .toEqual({ address: { equals: INSTANT, mode: 'insensitive' } });
    });

    it('should refuse a value which denotes no instant', () => {
        expect(() => build(eq('created_at', 'yesterday')))
            .toThrowError(expect.objectContaining({ code: ErrorCode.KEY_VALUE_INVALID }));
        expect(() => build(eq('created_at', 'yesterday')))
            .toThrowError(AdapterError);
    });
});
