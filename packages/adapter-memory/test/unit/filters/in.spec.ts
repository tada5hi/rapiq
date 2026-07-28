/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Filter,
    eq,
    inArray,
    ne,
    nin,
} from '@rapiq/core';
import { compileFilters } from '../../../src';

describe('filters: in & nin', () => {
    it('should match by membership', () => {
        const predicate = compileFilters(inArray('id', [1, 2]));

        expect(predicate({ id: 1 })).toBeTruthy();
        expect(predicate({ id: 3 })).toBeFalsy();
    });

    it('should match nothing for an empty list', () => {
        expect(compileFilters(inArray('id', []))({ id: 1 })).toBeFalsy();
    });

    it('should match everything for an empty negated list', () => {
        expect(compileFilters(nin('id', []))({ id: 1 })).toBeTruthy();
    });

    it('should totalize a non-array value to false', () => {
        const predicate = compileFilters(new Filter('in', 'id', 'nope'));

        expect(predicate({ id: 'nope' })).toBeFalsy();
        expect(predicate({ id: 'other' })).toBeFalsy();
    });

    it('should match dates inside the list by value', () => {
        const predicate = compileFilters(inArray('created_at', [new Date('2023-01-01')]));

        expect(predicate({ created_at: new Date('2023-01-01') })).toBeTruthy();
        expect(predicate({ created_at: new Date('2024-01-01') })).toBeFalsy();
    });

    it('should match null and missing values via a null element', () => {
        const predicate = compileFilters(inArray('realm_id', [1, null]));

        expect(predicate({ realm_id: 1 })).toBeTruthy();
        expect(predicate({ realm_id: null })).toBeTruthy();
        expect(predicate({})).toBeTruthy();
        expect(predicate({ realm_id: 2 })).toBeFalsy();
    });

    it('should not match null values without a null element', () => {
        const predicate = compileFilters(inArray('realm_id', [1, 2]));

        expect(predicate({ realm_id: null })).toBeFalsy();
        expect(predicate({})).toBeFalsy();
    });

    describe('nin', () => {
        it('should be the complement of in', () => {
            const predicate = compileFilters(nin('id', [1, 2]));

            expect(predicate({ id: 3 })).toBeTruthy();
            expect(predicate({ id: 1 })).toBeFalsy();
        });

        it('should match null and missing values', () => {
            const predicate = compileFilters(nin('id', [1, 2]));

            expect(predicate({ id: null })).toBeTruthy();
            expect(predicate({})).toBeTruthy();
        });

        it('should not match null values when the list holds null', () => {
            const predicate = compileFilters(nin('id', [1, null]));

            expect(predicate({ id: null })).toBeFalsy();
            expect(predicate({})).toBeFalsy();
            expect(predicate({ id: 2 })).toBeTruthy();
        });
    });

    describe('array values', () => {
        it('should treat eq as element membership', () => {
            expect(compileFilters(eq('tags', 'a'))({ tags: ['a', 'b'] })).toBeTruthy();
            expect(compileFilters(eq('tags', 'c'))({ tags: ['a', 'b'] })).toBeFalsy();
            expect(compileFilters(eq('tags', 'a'))({ tags: [] })).toBeFalsy();
        });

        it('should treat ne as not-containing', () => {
            expect(compileFilters(ne('tags', 'a'))({ tags: ['a', 'b'] })).toBeFalsy();
            expect(compileFilters(ne('tags', 'c'))({ tags: ['a', 'b'] })).toBeTruthy();
        });

        it('should treat in as intersection', () => {
            expect(compileFilters(inArray('tags', ['b', 'c']))({ tags: ['a', 'b'] })).toBeTruthy();
            expect(compileFilters(inArray('tags', ['c', 'd']))({ tags: ['a', 'b'] })).toBeFalsy();
        });
    });
});
