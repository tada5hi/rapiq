/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    ErrorCode,
    Filter,
    Filters,
    and,
    eq,
    gte,
    or,
} from '@rapiq/core';
import { compileFilters } from '../../../src';

describe('filters: compounds', () => {
    it('should combine conditions with and', () => {
        const predicate = compileFilters(and(eq('name', 'Peter'), gte('age', 18)));

        expect(predicate({ name: 'Peter', age: 28 })).toBeTruthy();
        expect(predicate({ name: 'Peter', age: 17 })).toBeFalsy();
        expect(predicate({ name: 'Aston', age: 28 })).toBeFalsy();
    });

    it('should combine conditions with or', () => {
        const predicate = compileFilters(or(eq('name', 'Peter'), gte('age', 18)));

        expect(predicate({ name: 'Peter', age: 17 })).toBeTruthy();
        expect(predicate({ name: 'Aston', age: 18 })).toBeTruthy();
        expect(predicate({ name: 'Aston', age: 17 })).toBeFalsy();
    });

    it('should evaluate nested compounds', () => {
        const predicate = compileFilters(or(
            and(eq('name', 'Peter'), gte('age', 18)),
            eq('admin', true),
        ));

        expect(predicate({ name: 'Peter', age: 20 })).toBeTruthy();
        expect(predicate({
            name: 'Aston', 
            age: 20, 
            admin: true, 
        })).toBeTruthy();
        expect(predicate({ name: 'Aston', age: 20 })).toBeFalsy();
    });

    it('should treat an empty root compound as match-all', () => {
        expect(compileFilters(and())({ id: 1 })).toBeTruthy();
        expect(compileFilters(or())({ id: 1 })).toBeTruthy();
    });

    it('should let empty nested compounds vanish', () => {
        // an empty or() nested in an and() contributes nothing,
        // exactly like an empty child adapter in the sql merge step.
        const predicate = compileFilters(and(eq('id', 1), or()));

        expect(predicate({ id: 1 })).toBeTruthy();
        expect(predicate({ id: 2 })).toBeFalsy();

        const emptyOnly = compileFilters(or(and(), or()));

        expect(emptyOnly({ id: 1 })).toBeTruthy();
    });

    it('should let an empty child of an or vanish, not force it true', () => {
        // sql parity: an empty compound produces no condition, so the sql
        // adapter's merge() skips it entirely — the or reduces to its
        // remaining child rather than becoming always-true.
        const predicate = compileFilters(or(eq('id', 1), and()));

        expect(predicate({ id: 1 })).toBeTruthy();
        expect(predicate({ id: 2 })).toBeFalsy();
    });

    it('should negate nor/not groups (plain boolean not, sql parity)', () => {
        const nor = compileFilters(new Filters('nor', [
            eq('id', 1),
            eq('id', 2),
        ]));

        expect(nor({ id: 3 })).toBeTruthy();
        expect(nor({ id: 1 })).toBeFalsy();
        expect(nor({ id: 2 })).toBeFalsy();

        const not = compileFilters(new Filters('not', [
            and(eq('name', 'Peter'), gte('age', 18)),
        ]));

        expect(not({ name: 'Peter', age: 28 })).toBeFalsy();
        expect(not({ name: 'Peter', age: 17 })).toBeTruthy();
    });

    it('should throw on an unknown compound operator', () => {
        expect(() => compileFilters(new Filters('xor', [eq('id', 1)])))
            .toThrow(AdapterError);

        try {
            compileFilters(new Filters('xor', [eq('id', 1)]));
        } catch (e) {
            expect(e).toBeInstanceOf(AdapterError);
            expect((e as AdapterError).code).toEqual(ErrorCode.OPERATOR_UNSUPPORTED);
        }
    });

    it('should throw on an unknown filter operator', () => {
        expect(() => compileFilters(new Filter('like', 'name', 'Peter')))
            .toThrow(AdapterError);

        try {
            compileFilters(new Filter('like', 'name', 'Peter'));
        } catch (e) {
            expect(e).toBeInstanceOf(AdapterError);
            expect((e as AdapterError).code).toEqual(ErrorCode.OPERATOR_UNSUPPORTED);
        }
    });
});
