/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    and,
    contains,
    elemMatch,
    endsWith,
    eq,
    exists,
    gt,
    gte,
    inArray,
    lt,
    lte,
    mod,
    ne,
    nin,
    notContains,
    notEndsWith,
    notStartsWith,
    or,
    regex,
    startsWith,
} from '../../../src';
import type { User } from '../../data';

describe('src/parameter/filters/helpers/*.ts', () => {
    it.each([
        [eq, FilterFieldOperator.EQUAL, 'John'],
        [ne, FilterFieldOperator.NOT_EQUAL, 'John'],
        [lt, FilterFieldOperator.LESS_THAN, 18],
        [lte, FilterFieldOperator.LESS_THAN_EQUAL, 18],
        [gt, FilterFieldOperator.GREATER_THAN, 18],
        [gte, FilterFieldOperator.GREATER_THAN_EQUAL, 18],
        [startsWith, FilterFieldOperator.STARTS_WITH, 'Jo'],
        [notStartsWith, FilterFieldOperator.NOT_STARTS_WITH, 'Jo'],
        [endsWith, FilterFieldOperator.ENDS_WITH, 'hn'],
        [notEndsWith, FilterFieldOperator.NOT_ENDS_WITH, 'hn'],
        [contains, FilterFieldOperator.CONTAINS, 'oh'],
        [notContains, FilterFieldOperator.NOT_CONTAINS, 'oh'],
    ] as const)('should build a leaf condition (%#)', (helper, operator, value) => {
        const output = helper('name', value as never);

        expect(output).toBeInstanceOf(Filter);
        expect(output.operator).toBe(operator);
        expect(output.field).toBe('name');
        expect(output.value).toBe(value);
    });

    it('should build in / nin conditions with null as a legal element', () => {
        const input = inArray('realm.id', [1, null]);
        expect(input.operator).toBe(FilterFieldOperator.IN);
        expect(input.value).toEqual([1, null]);

        const notIn = nin('realm.id', [1, null]);
        expect(notIn.operator).toBe(FilterFieldOperator.NOT_IN);
        expect(notIn.value).toEqual([1, null]);
    });

    it('should build a regex condition', () => {
        const pattern = /^Jo/i;
        const output = regex('name', pattern);

        expect(output.operator).toBe(FilterFieldOperator.REGEX);
        expect(output.value).toBe(pattern);
    });

    it('should build a mod condition as [divisor, remainder]', () => {
        const output = mod('age', 4, 0);

        expect(output.operator).toBe(FilterFieldOperator.MOD);
        expect(output.value).toEqual([4, 0]);
    });

    it('should build an exists condition (default true)', () => {
        expect(exists('email').value).toBe(true);
        expect(exists('email', false).value).toBe(false);
        expect(exists('email').operator).toBe(FilterFieldOperator.EXISTS);
    });

    it('should build an elemMatch condition wrapping a child condition', () => {
        const child = eq('name', 'chess');
        const output = elemMatch('items', child);

        expect(output.operator).toBe(FilterFieldOperator.ELEM_MATCH);
        expect(output.field).toBe('items');
        expect(output.value).toBe(child);
    });

    it('should build and / or compounds', () => {
        const left = eq('name', 'John');
        const right = gte('age', 18);

        const conjunction = and(left, right);
        expect(conjunction).toBeInstanceOf(Filters);
        expect(conjunction.operator).toBe(FilterCompoundOperator.AND);
        expect(conjunction.value).toEqual([left, right]);

        const disjunction = or(left, right);
        expect(disjunction.operator).toBe(FilterCompoundOperator.OR);
        expect(disjunction.value).toEqual([left, right]);
    });

    it('should support nesting compounds', () => {
        const output = and(
            eq('name', 'John'),
            or(gte('age', 18), eq('email', null)),
        );

        expect(output.value).toHaveLength(2);
        expect(output.value[1]).toBeInstanceOf(Filters);
        expect((output.value[1] as Filters).operator).toBe(FilterCompoundOperator.OR);
    });

    it('should type field paths against a supplied record generic', () => {
        // compile-time check: nested key paths are accepted with a generic,
        // plain strings without one.
        const typed = eq<User>('realm.name', 'master');
        expect(typed.field).toBe('realm.name');

        const untyped = eq('anything.goes', 1);
        expect(untyped.field).toBe('anything.goes');
    });
});
