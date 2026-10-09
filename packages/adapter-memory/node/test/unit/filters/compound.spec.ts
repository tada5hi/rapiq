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
    elemMatch,
    eq,
    gt,
    gte,
    not,
    or,
    size,
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

    it('should negate nor/not groups (exact complement, sql parity)', () => {
        const norPredicate = compileFilters(new Filters('nor', [
            eq('id', 1),
            eq('id', 2),
        ]));

        expect(norPredicate({ id: 3 })).toBeTruthy();
        expect(norPredicate({ id: 1 })).toBeFalsy();
        expect(norPredicate({ id: 2 })).toBeFalsy();

        const predicate = compileFilters(not(
            and(eq('name', 'Peter'), gte('age', 18)),
        ));

        expect(predicate({ name: 'Peter', age: 28 })).toBeFalsy();
        expect(predicate({ name: 'Peter', age: 17 })).toBeTruthy();
    });

    it('should match null-bearing records under a negated group (complement law)', () => {
        // not(c) matches exactly the records c does not match — the
        // null-inclusive complement law extended to trees.
        const predicate = compileFilters(not(gt('age', 50)));

        expect(predicate({ age: 18 })).toBeTruthy();
        expect(predicate({ age: null })).toBeTruthy();
        expect(predicate({})).toBeTruthy();
        expect(predicate({ age: 60 })).toBeFalsy();

        const group = compileFilters(not(or(gt('age', 50), eq('name', 'Peter'))));

        expect(group({ age: null, name: null })).toBeTruthy();
        expect(group({ age: 60, name: null })).toBeFalsy();
        expect(group({ age: null, name: 'Peter' })).toBeFalsy();
    });

    it('should cancel a double negation', () => {
        const predicate = compileFilters(not(not(gt('age', 50))));

        expect(predicate({ age: 60 })).toBeTruthy();
        expect(predicate({ age: 18 })).toBeFalsy();
        expect(predicate({ age: null })).toBeFalsy();
    });

    it('should complement size and elemMatch under not', () => {
        const sizePredicate = compileFilters(not(size('items', 2)));

        expect(sizePredicate({ items: [1, 2] })).toBeFalsy();
        expect(sizePredicate({ items: [1] })).toBeTruthy();
        expect(sizePredicate({})).toBeTruthy();

        const element = compileFilters(not(elemMatch('items', eq('id', 1))));

        expect(element({ items: [{ id: 1 }] })).toBeFalsy();
        expect(element({ items: [{ id: 2 }] })).toBeTruthy();
        expect(element({ items: [] })).toBeTruthy();
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
