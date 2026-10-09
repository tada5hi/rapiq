/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Filter } from '@rapiq/core';
import {
    contains,
    endsWith,
    eq,
    exists,
    inArray,
    ne,
    nin,
    notContains,
    notEndsWith,
    notStartsWith,
    startsWith,
} from '@rapiq/core';
import { compileFilters } from '../../../src';

const inputs : Record<string, any>[] = [
    { value: 'Peter' },
    { value: 'peter' },
    { value: '' },
    { value: 18 },
    { value: 0 },
    { value: null },
    { value: undefined },
    {},
    { value: true },
    { value: new Date('2023-01-01') },
    { value: ['a', 'b'] },
    { value: [] },
    { value: { nested: true } },
];

const pairs : [string, Filter, Filter][] = [
    ['eq/ne', eq('value', 'Peter'), ne('value', 'Peter')],
    ['eq/ne (null)', eq('value', null), ne('value', null)],
    ['in/nin', inArray('value', ['Peter', 18]), nin('value', ['Peter', 18])],
    ['in/nin (null element)', inArray('value', [18, null]), nin('value', [18, null])],
    ['in/nin (empty)', inArray('value', []), nin('value', [])],
    ['contains/notContains', contains('value', 'ete'), notContains('value', 'ete')],
    ['startsWith/notStartsWith', startsWith('value', 'Pe'), notStartsWith('value', 'Pe')],
    ['endsWith/notEndsWith', endsWith('value', 'er'), notEndsWith('value', 'er')],
    ['exists true/false', exists('value'), exists('value', false)],
];

describe('filters: complement law', () => {
    // every negated operator is the exact complement of its positive
    // twin on root fields — including null, missing and array values.
    pairs.forEach(([name, positive, negative]) => {
        it(`should hold for ${name}`, () => {
            const positivePredicate = compileFilters(positive);
            const negativePredicate = compileFilters(negative);

            inputs.forEach((input) => {
                expect(negativePredicate(input)).toEqual(!positivePredicate(input));
            });
        });
    });

    it('should not hold across join-row bindings (any-quantified negation)', () => {
        const input = { items: [{ title: 'first' }, { title: 'second' }] };

        // both match: some row equals 'first', some row differs.
        expect(compileFilters(eq('items.title', 'first'))(input)).toBeTruthy();
        expect(compileFilters(ne('items.title', 'first'))(input)).toBeTruthy();
    });
});
