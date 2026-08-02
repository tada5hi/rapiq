/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IFilter, IFilterVisitor } from '../../../src';
import {
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
} from '../../../src';

describe('src/parameter/filters/record/*.ts', () => {
    describe('Filter.accept', () => {
        it('should route every operator to visitFilter', () => {
            const visitor : IFilterVisitor<string> = { visitFilter: (expr: IFilter) => `${expr.operator}` };
            Object.values(FilterFieldOperator).forEach((operator) => {
                expect(new Filter(operator, 'field', 1).accept(visitor)).toBe(operator);
            });
        });

        it('should route an unknown operator to visitFilter', () => {
            const visitor : IFilterVisitor<string> = { visitFilter: () => 'fallback' };
            expect(new Filter('totally-unknown', 'field', 1).accept(visitor)).toBe('fallback');
        });
    });
});

describe('src/parameter/filters/collection/*.ts', () => {
    describe('Filters.flatten', () => {
        it('should hoist a nested group sharing the parent operator', () => {
            const a = new Filter(FilterFieldOperator.EQUAL, 'a', 1);
            const b = new Filter(FilterFieldOperator.EQUAL, 'b', 2);
            const c = new Filter(FilterFieldOperator.EQUAL, 'c', 3);

            const inner = new Filters(FilterCompoundOperator.AND, [a, b]);
            const outer = new Filters(FilterCompoundOperator.AND, [c, inner]);

            const flat = outer.flatten();

            expect(flat.operator).toBe(FilterCompoundOperator.AND);
            expect(flat.value).toEqual([c, a, b]);
        });

        it('should keep a nested group with a different operator nested', () => {
            const a = new Filter(FilterFieldOperator.EQUAL, 'a', 1);
            const b = new Filter(FilterFieldOperator.EQUAL, 'b', 2);
            const c = new Filter(FilterFieldOperator.EQUAL, 'c', 3);

            const innerOr = new Filters(FilterCompoundOperator.OR, [a, b]);
            const outer = new Filters(FilterCompoundOperator.AND, [c, innerOr]);

            const flat = outer.flatten();

            expect(flat.operator).toBe(FilterCompoundOperator.AND);
            expect(flat.value).toHaveLength(2);
            expect(flat.value[0]).toEqual(c);
            // The differing-operator group stays nested (structure, not identity).
            expect(flat.value[1]).toEqual(innerOr);
            expect((flat.value[1] as Filters).operator).toBe(FilterCompoundOperator.OR);
        });

        it('should hoist recursively across multiple same-operator levels', () => {
            const a = new Filter(FilterFieldOperator.EQUAL, 'a', 1);
            const b = new Filter(FilterFieldOperator.EQUAL, 'b', 2);
            const c = new Filter(FilterFieldOperator.EQUAL, 'c', 3);

            const innermost = new Filters(FilterCompoundOperator.AND, [a]);
            const middle = new Filters(FilterCompoundOperator.AND, [b, innermost]);
            const outer = new Filters(FilterCompoundOperator.AND, [c, middle]);

            const flat = outer.flatten();
            expect(flat.value).toEqual([c, b, a]);
        });

        it('should leave a flat group unchanged', () => {
            const a = new Filter(FilterFieldOperator.EQUAL, 'a', 1);
            const b = new Filter(FilterFieldOperator.EQUAL, 'b', 2);

            const filters = new Filters(FilterCompoundOperator.AND, [a, b]);
            const flat = filters.flatten();

            expect(flat.value).toEqual([a, b]);
        });

        it('should never hoist through a NOT group (not associative)', () => {
            const a = new Filter(FilterFieldOperator.EQUAL, 'a', 1);

            const inner = new Filters(FilterCompoundOperator.NOT, [a]);
            const outer = new Filters(FilterCompoundOperator.NOT, [inner]);

            // hoisting would turn not(not(a)) into not(a) — the
            // opposite meaning.
            const flat = outer.flatten();
            expect(flat.operator).toBe(FilterCompoundOperator.NOT);
            expect(flat.value).toEqual([inner]);
        });
    });
});
