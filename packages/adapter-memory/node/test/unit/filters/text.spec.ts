/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    contains,
    endsWith,
    notContains,
    notEndsWith,
    notStartsWith,
    regex,
    startsWith,
} from '@rapiq/core';
import { compileFilters } from '../../../src';

describe('filters: text operators', () => {
    describe('contains family', () => {
        it('should match substrings case-insensitively', () => {
            expect(compileFilters(contains('name', 'eter'))({ name: 'Peter' })).toBeTruthy();
            expect(compileFilters(contains('name', 'PETER'))({ name: 'peter' })).toBeTruthy();
            expect(compileFilters(contains('name', 'x'))({ name: 'Peter' })).toBeFalsy();
        });

        it('should anchor startsWith and endsWith', () => {
            expect(compileFilters(startsWith('name', 'pe'))({ name: 'Peter' })).toBeTruthy();
            expect(compileFilters(startsWith('name', 'eter'))({ name: 'Peter' })).toBeFalsy();
            expect(compileFilters(endsWith('name', 'TER'))({ name: 'Peter' })).toBeTruthy();
            expect(compileFilters(endsWith('name', 'Pe'))({ name: 'Peter' })).toBeFalsy();
        });

        it('should treat the value as a literal, not a pattern', () => {
            expect(compileFilters(contains('name', 'a.c'))({ name: 'abc' })).toBeFalsy();
            expect(compileFilters(contains('name', 'a.c'))({ name: 'xa.cx' })).toBeTruthy();
        });

        it('should stringify numeric values', () => {
            expect(compileFilters(contains('age', '8'))({ age: 18 })).toBeTruthy();
            expect(compileFilters(startsWith('age', '1'))({ age: 18 })).toBeTruthy();
        });

        it('should never match non-textual values', () => {
            expect(compileFilters(contains('name', 'a'))({ name: null })).toBeFalsy();
            expect(compileFilters(contains('name', 'a'))({})).toBeFalsy();
            expect(compileFilters(contains('name', 'a'))({ name: true })).toBeFalsy();
            expect(compileFilters(contains('name', 'a'))({ name: {} })).toBeFalsy();
        });

        it('should negate as a complement, including null and missing values', () => {
            expect(compileFilters(notContains('name', 'eter'))({ name: 'Peter' })).toBeFalsy();
            expect(compileFilters(notContains('name', 'x'))({ name: 'Peter' })).toBeTruthy();
            expect(compileFilters(notContains('name', 'x'))({ name: null })).toBeTruthy();
            expect(compileFilters(notContains('name', 'x'))({})).toBeTruthy();
            expect(compileFilters(notStartsWith('name', 'Pe'))({ name: 'Peter' })).toBeFalsy();
            expect(compileFilters(notEndsWith('name', 'ter'))({})).toBeTruthy();
        });

        it('should match string array elements', () => {
            expect(compileFilters(contains('tags', 'oo'))({ tags: ['foo', 'bar'] })).toBeTruthy();
            expect(compileFilters(contains('tags', 'zz'))({ tags: ['foo', 'bar'] })).toBeFalsy();
        });
    });

    describe('regex', () => {
        it('should test a regexp value', () => {
            expect(compileFilters(regex('name', /^pe/i))({ name: 'Peter' })).toBeTruthy();
            expect(compileFilters(regex('name', /^pe/))({ name: 'Peter' })).toBeFalsy();
        });

        it('should accept a string pattern', () => {
            expect(compileFilters(regex('name', '^Pe'))({ name: 'Peter' })).toBeTruthy();
            expect(compileFilters(regex('name', '^pe'))({ name: 'Peter' })).toBeFalsy();
        });

        it('should evaluate statefully flagged patterns consistently', () => {
            const predicate = compileFilters(regex('name', /e/g));

            expect(predicate({ name: 'Peter' })).toBeTruthy();
            expect(predicate({ name: 'Peter' })).toBeTruthy();
            expect(predicate({ name: 'Peter' })).toBeTruthy();
        });

        it('should never match non-textual values', () => {
            expect(compileFilters(regex('name', /.*/))({ name: null })).toBeFalsy();
            expect(compileFilters(regex('name', /.*/))({})).toBeFalsy();
        });

        it('should throw on a malformed pattern', () => {
            expect(() => compileFilters(regex('name', '('))).toThrow(AdapterError);
        });
    });
});
