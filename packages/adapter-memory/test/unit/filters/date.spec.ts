/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    eq,
    gte,
    inArray,
    lt,
    ne,
} from '@rapiq/core';
import { compileFilters } from '../../../src';

const record = { created_at: new Date('2026-08-23T10:16:44.000Z') };

describe('filters: date operands', () => {
    it('should compare a wire string against a date value as an instant', () => {
        expect(compileFilters(gte('created_at', '2026-08-23T00:00:00.000Z'))(record)).toBeTruthy();
        expect(compileFilters(gte('created_at', '2026-08-24T00:00:00.000Z'))(record)).toBeFalsy();
        expect(compileFilters(lt('created_at', '2026-08-24T00:00:00.000Z'))(record)).toBeTruthy();
    });

    it('should match equality against a date value by instant', () => {
        expect(compileFilters(eq('created_at', '2026-08-23T10:16:44.000Z'))(record)).toBeTruthy();
        expect(compileFilters(eq('created_at', '2026-08-23T10:16:45.000Z'))(record)).toBeFalsy();
        expect(compileFilters(ne('created_at', '2026-08-23T10:16:44.000Z'))(record)).toBeFalsy();
    });

    it('should match list membership against a date value by instant', () => {
        const condition = inArray('created_at', [
            '2026-08-22T10:16:44.000Z',
            '2026-08-23T10:16:44.000Z',
        ]);

        expect(compileFilters(condition)(record)).toBeTruthy();
    });

    it('should keep a number incomparable against a date value', () => {
        // this backend infers temporality from the record value alone,
        // so an epoch number stays a guess it does not make.
        expect(compileFilters(eq('created_at', record.created_at.getTime()))(record)).toBeFalsy();
    });

    it('should not match a string which denotes no instant', () => {
        expect(compileFilters(eq('created_at', 'foo'))(record)).toBeFalsy();
        expect(compileFilters(gte('created_at', 'foo'))(record)).toBeFalsy();
    });

    it('should keep two strings compared as strings', () => {
        const textual = { created_at: '2026-08-23T10:16:44.000Z' };

        expect(compileFilters(eq('created_at', '2026-08-23T10:16:44.000Z'))(textual)).toBeTruthy();
        expect(compileFilters(eq('created_at', '2026-08-23T10:16:44Z'))(textual)).toBeFalsy();
    });

    it('should keep strings and numbers strictly typed', () => {
        expect(compileFilters(eq('age', '18'))({ age: 18 })).toBeFalsy();
    });
});
