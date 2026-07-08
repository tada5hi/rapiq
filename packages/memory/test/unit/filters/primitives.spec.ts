/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Filter,
    eq,
    exists,
    gt,
    gte,
    lt,
    lte,
    mod,
    ne,
} from '@rapiq/core';
import { compileFilters } from '../../../src';

describe('filters: primitive operators', () => {
    describe('eq', () => {
        it('should match equal scalars', () => {
            expect(compileFilters(eq('age', 18))({ age: 18 })).toBeTruthy();
            expect(compileFilters(eq('age', 18))({ age: 19 })).toBeFalsy();
            expect(compileFilters(eq('name', 'Peter'))({ name: 'Peter' })).toBeTruthy();
        });

        it('should not coerce across types', () => {
            expect(compileFilters(eq('age', '18'))({ age: 18 })).toBeFalsy();
            expect(compileFilters(eq('active', 1))({ active: true })).toBeFalsy();
        });

        it('should match dates by value', () => {
            const condition = eq('created_at', new Date('2023-01-01T00:00:00Z'));

            expect(compileFilters(condition)({ created_at: new Date('2023-01-01T00:00:00Z') })).toBeTruthy();
            expect(compileFilters(condition)({ created_at: new Date('2024-01-01T00:00:00Z') })).toBeFalsy();
        });

        it('should match null against null, missing and undefined values', () => {
            const predicate = compileFilters(eq('age', null));

            expect(predicate({ age: null })).toBeTruthy();
            expect(predicate({})).toBeTruthy();
            expect(predicate({ age: undefined })).toBeTruthy();
            expect(predicate({ age: 18 })).toBeFalsy();
        });

        it('should match object and array values structurally', () => {
            expect(compileFilters(eq('meta', { a: 1, b: [2, 3] }))({ meta: { a: 1, b: [2, 3] } })).toBeTruthy();
            expect(compileFilters(eq('meta', { a: 1 }))({ meta: { a: 2 } })).toBeFalsy();
        });
    });

    describe('ne', () => {
        it('should be the complement of eq', () => {
            const predicate = compileFilters(ne('age', 18));

            expect(predicate({ age: 19 })).toBeTruthy();
            expect(predicate({ age: 18 })).toBeFalsy();
        });

        it('should match null and missing values', () => {
            const predicate = compileFilters(ne('name', 'Peter'));

            expect(predicate({ name: null })).toBeTruthy();
            expect(predicate({})).toBeTruthy();
        });

        it('should not match null when comparing against null', () => {
            const predicate = compileFilters(ne('age', null));

            expect(predicate({ age: null })).toBeFalsy();
            expect(predicate({})).toBeFalsy();
            expect(predicate({ age: 18 })).toBeTruthy();
        });
    });

    describe('lt/lte/gt/gte', () => {
        it('should compare numbers', () => {
            expect(compileFilters(lt('age', 18))({ age: 17 })).toBeTruthy();
            expect(compileFilters(lt('age', 18))({ age: 18 })).toBeFalsy();
            expect(compileFilters(lte('age', 18))({ age: 18 })).toBeTruthy();
            expect(compileFilters(gt('age', 18))({ age: 19 })).toBeTruthy();
            expect(compileFilters(gt('age', 18))({ age: 18 })).toBeFalsy();
            expect(compileFilters(gte('age', 18))({ age: 18 })).toBeTruthy();
        });

        it('should compare strings and dates', () => {
            expect(compileFilters(gt('name', 'a'))({ name: 'b' })).toBeTruthy();
            expect(compileFilters(lt('created_at', new Date('2024-01-01')))({ created_at: new Date('2023-01-01') })).toBeTruthy();
        });

        it('should never match null or missing values', () => {
            expect(compileFilters(lt('age', 18))({ age: null })).toBeFalsy();
            expect(compileFilters(lt('age', 18))({})).toBeFalsy();
            expect(compileFilters(gte('age', 18))({ age: null })).toBeFalsy();
        });

        it('should never match across types', () => {
            expect(compileFilters(gt('age', '17'))({ age: 18 })).toBeFalsy();
            expect(compileFilters(lt('age', true))({ age: 0 })).toBeFalsy();
            expect(compileFilters(gt('created_at', 5))({ created_at: new Date(5) })).toBeFalsy();
            expect(compileFilters(gte('created_at', 5))({ created_at: new Date(4) })).toBeFalsy();
            expect(compileFilters(lt('age', new Date(5)))({ age: 3 })).toBeFalsy();
        });

        it('should compare booleans', () => {
            expect(compileFilters(lt('active', true))({ active: false })).toBeTruthy();
            expect(compileFilters(gt('active', false))({ active: true })).toBeTruthy();
            expect(compileFilters(gt('active', false))({ active: false })).toBeFalsy();
        });

        it('should match some element of an array value', () => {
            expect(compileFilters(gt('scores', 10))({ scores: [5, 20] })).toBeTruthy();
            expect(compileFilters(gt('scores', 10))({ scores: [5, 6] })).toBeFalsy();
        });
    });

    describe('exists', () => {
        it('should treat exists as is-not-null', () => {
            expect(compileFilters(exists('age'))({ age: 18 })).toBeTruthy();
            expect(compileFilters(exists('age'))({ age: 0 })).toBeTruthy();
            expect(compileFilters(exists('age'))({ age: null })).toBeFalsy();
            expect(compileFilters(exists('age'))({ age: undefined })).toBeFalsy();
            expect(compileFilters(exists('age'))({})).toBeFalsy();
        });

        it('should treat exists false as is-null', () => {
            expect(compileFilters(exists('age', false))({ age: null })).toBeTruthy();
            expect(compileFilters(exists('age', false))({})).toBeTruthy();
            expect(compileFilters(exists('age', false))({ age: 18 })).toBeFalsy();
        });

        it('should ignore inherited properties', () => {
            expect(compileFilters(exists('toString'))({})).toBeFalsy();
            expect(compileFilters(exists('constructor'))({})).toBeFalsy();
        });

        it('should treat an array value itself as existing', () => {
            expect(compileFilters(exists('tags'))({ tags: [] })).toBeTruthy();
            expect(compileFilters(exists('tags'))({ tags: ['a'] })).toBeTruthy();
            expect(compileFilters(exists('tags', false))({ tags: [] })).toBeFalsy();
        });
    });

    describe('mod', () => {
        it('should match by divisor and remainder', () => {
            expect(compileFilters(mod('age', 2, 0))({ age: 18 })).toBeTruthy();
            expect(compileFilters(mod('age', 2, 1))({ age: 18 })).toBeFalsy();
        });

        it('should never match non-numeric or absent values', () => {
            expect(compileFilters(mod('age', 2, 0))({ age: '18' })).toBeFalsy();
            expect(compileFilters(mod('age', 2, 0))({ age: null })).toBeFalsy();
            expect(compileFilters(mod('age', 2, 0))({})).toBeFalsy();
        });

        it('should never match with a zero divisor', () => {
            expect(compileFilters(mod('age', 0, 0))({ age: 18 })).toBeFalsy();
        });

        it('should totalize a malformed value tuple to false', () => {
            expect(compileFilters(new Filter('mod', 'age', [2]))({ age: 18 })).toBeFalsy();
            expect(compileFilters(new Filter('mod', 'age', 2))({ age: 18 })).toBeFalsy();
        });

        it('should match some element of an array value', () => {
            expect(compileFilters(mod('scores', 2, 0))({ scores: [1, 4] })).toBeTruthy();
            expect(compileFilters(mod('scores', 2, 0))({ scores: [1, 3] })).toBeFalsy();
        });
    });
});
