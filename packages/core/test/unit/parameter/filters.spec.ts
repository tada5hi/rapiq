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

/**
 * A real visitor that reports which method handled the filter — so dispatch
 * can be observed through the public interface instead of mocking.
 */
class NamingFilterVisitor implements IFilterVisitor<string> {
    visitFilter(_: IFilter) {
        return 'visitFilter';
    }

    visitFilterEqual(_: IFilter) {
        return 'visitFilterEqual';
    }

    visitFilterNotEqual(_: IFilter) {
        return 'visitFilterNotEqual';
    }

    visitFilterLessThan(_: IFilter) {
        return 'visitFilterLessThan';
    }

    visitFilterLessThanEqual(_: IFilter) {
        return 'visitFilterLessThanEqual';
    }

    visitFilterGreaterThan(_: IFilter) {
        return 'visitFilterGreaterThan';
    }

    visitFilterGreaterThanEqual(_: IFilter) {
        return 'visitFilterGreaterThanEqual';
    }

    visitFilterExists(_: IFilter) {
        return 'visitFilterExists';
    }

    visitFilterIn(_: IFilter) {
        return 'visitFilterIn';
    }

    visitFilterNotIn(_: IFilter) {
        return 'visitFilterNotIn';
    }

    visitFilterMod(_: IFilter) {
        return 'visitFilterMod';
    }

    visitFilterElemMatch(_: IFilter) {
        return 'visitFilterElemMatch';
    }

    visitFilterContains(_: IFilter) {
        return 'visitFilterContains';
    }

    visitFilterNotContains(_: IFilter) {
        return 'visitFilterNotContains';
    }

    visitFilterStartsWith(_: IFilter) {
        return 'visitFilterStartsWith';
    }

    visitFilterNotStartsWith(_: IFilter) {
        return 'visitFilterNotStartsWith';
    }

    visitFilterEndsWith(_: IFilter) {
        return 'visitFilterEndsWith';
    }

    visitFilterNotEndsWith(_: IFilter) {
        return 'visitFilterNotEndsWith';
    }

    visitFilterRegex(_: IFilter) {
        return 'visitFilterRegex';
    }
}

const OPERATOR_METHOD: [string, string][] = [
    [FilterFieldOperator.EQUAL, 'visitFilterEqual'],
    [FilterFieldOperator.NOT_EQUAL, 'visitFilterNotEqual'],
    [FilterFieldOperator.LESS_THAN, 'visitFilterLessThan'],
    [FilterFieldOperator.LESS_THAN_EQUAL, 'visitFilterLessThanEqual'],
    [FilterFieldOperator.GREATER_THAN, 'visitFilterGreaterThan'],
    [FilterFieldOperator.GREATER_THAN_EQUAL, 'visitFilterGreaterThanEqual'],
    [FilterFieldOperator.EXISTS, 'visitFilterExists'],
    [FilterFieldOperator.IN, 'visitFilterIn'],
    [FilterFieldOperator.NOT_IN, 'visitFilterNotIn'],
    [FilterFieldOperator.MOD, 'visitFilterMod'],
    [FilterFieldOperator.ELEM_MATCH, 'visitFilterElemMatch'],
    [FilterFieldOperator.CONTAINS, 'visitFilterContains'],
    [FilterFieldOperator.NOT_CONTAINS, 'visitFilterNotContains'],
    [FilterFieldOperator.STARTS_WITH, 'visitFilterStartsWith'],
    [FilterFieldOperator.NOT_STARTS_WITH, 'visitFilterNotStartsWith'],
    [FilterFieldOperator.ENDS_WITH, 'visitFilterEndsWith'],
    [FilterFieldOperator.NOT_ENDS_WITH, 'visitFilterNotEndsWith'],
    [FilterFieldOperator.REGEX, 'visitFilterRegex'],
];

describe('src/parameter/filters/record/*.ts', () => {
    describe('Filter.accept dispatch', () => {
        it.each(OPERATOR_METHOD)('should dispatch operator %s to %s', (operator, method) => {
            const filter = new Filter(operator, 'field', 1);
            expect(filter.accept(new NamingFilterVisitor())).toBe(method);
        });

        it('should fall back to visitFilter when the operator method is absent', () => {
            // Only the mandatory method is implemented — every operator must route to it.
            const visitor : IFilterVisitor<string> = {
                visitFilter: () => 'fallback',
            };
            OPERATOR_METHOD.forEach(([operator]) => {
                expect(new Filter(operator, 'field', 1).accept(visitor)).toBe('fallback');
            });
        });

        it('should use visitFilter for an unknown operator', () => {
            const filter = new Filter('totally-unknown', 'field', 1);
            expect(filter.accept(new NamingFilterVisitor())).toBe('visitFilter');
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
    });
});
