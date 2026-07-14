/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    eq,
    inArray,
    ne,
    nin,
} from '@rapiq/core';
import { compileFilters } from '../../../src';

describe('filters: equality case sensitivity', () => {
    it('should match string equality case-insensitively', () => {
        const predicate = compileFilters(eq('name', 'super hero'));

        expect(predicate({ name: 'Super Hero' })).toBeTruthy();
        expect(predicate({ name: 'sUpEr HeRo' })).toBeTruthy();
        expect(predicate({ name: 'super' })).toBeFalsy();
    });

    it('should complement ne under the same case rule', () => {
        const predicate = compileFilters(ne('name', 'super hero'));

        expect(predicate({ name: 'Super Hero' })).toBeFalsy();
        expect(predicate({ name: 'other' })).toBeTruthy();
    });

    it('should match in members case-insensitively', () => {
        const predicate = compileFilters(inArray('status', ['Active', 'Pending']));

        expect(predicate({ status: 'active' })).toBeTruthy();
        expect(predicate({ status: 'PENDING' })).toBeTruthy();
        expect(predicate({ status: 'closed' })).toBeFalsy();
    });

    it('should complement nin under the same case rule', () => {
        const predicate = compileFilters(nin('status', ['Active']));

        expect(predicate({ status: 'active' })).toBeFalsy();
        expect(predicate({ status: 'closed' })).toBeTruthy();
    });

    it('should not widen equality across types', () => {
        expect(compileFilters(eq('age', '18'))({ age: 18 })).toBeFalsy();
        expect(compileFilters(eq('name', 'null'))({ name: null })).toBeFalsy();
    });

    it('should keep fields listed in caseSensitive exact', () => {
        const predicate = compileFilters(eq('id', 'aBc'), { caseSensitive: ['id'] });

        expect(predicate({ id: 'aBc' })).toBeTruthy();
        expect(predicate({ id: 'ABC' })).toBeFalsy();
    });

    it('should keep caseSensitive in-lists exact', () => {
        const predicate = compileFilters(
            inArray('id', ['aBc']),
            { caseSensitive: ['id'] },
        );

        expect(predicate({ id: 'aBc' })).toBeTruthy();
        expect(predicate({ id: 'abc' })).toBeFalsy();
    });
});
