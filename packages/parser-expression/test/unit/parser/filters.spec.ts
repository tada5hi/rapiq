/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
} from 'rapiq';
import { ExpressionFiltersParser } from '../../../src';

describe('filters/expr-parser', () => {
    let parser : ExpressionFiltersParser;
    beforeAll(() => {
        parser = new ExpressionFiltersParser();
    });

    it('should parse eq expression', () => {
        const output = parser.parse('eq(name, \'admin\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'));
    });

    it('should parse not eq expression', () => {
        const output = parser.parse('not(eq(name, \'admin\'))');

        expect(output).toEqual(new Filter(FilterFieldOperator.NOT_EQUAL, 'name', 'admin'));
    });

    it('should parse not not eq expression', () => {
        const output = parser.parse('not(not(eq(name, \'admin\')))');

        expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'));
    });

    it('should parse lt expression', () => {
        const output = parser.parse('lt(age, \'18\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.LESS_THAN, 'age', 18));
    });

    it('should parse lte expression', () => {
        const output = parser.parse('lte(age, \'18\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.LESS_THAN_EQUAL, 'age', 18));
    });

    it('should parse gt expression', () => {
        const output = parser.parse('gt(age, \'18\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.GREATER_THAN, 'age', 18));
    });

    it('should parse gte expression', () => {
        const output = parser.parse('gte(age, \'18\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 18));
    });

    it('should parse contains expression', () => {
        const output = parser.parse('contains(name, \'Peter\')');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.CONTAINS,
            'name',
            'Peter',
        ));
    });

    it('should parse startsWith expression', () => {
        const output = parser.parse('startsWith(name, \'Peter\')');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.STARTS_WITH,
            'name',
            'Peter',
        ));
    });

    it('should parse endsWith expression', () => {
        const output = parser.parse('endsWith(name, \'Peter\')');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.ENDS_WITH,
            'name',
            'Peter',
        ));
    });

    it('should parse in expression', () => {
        const output = parser.parse('in(name, \'Peter\', \'Hans\')');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.IN,
            'name',
            [
                'Peter',
                'Hans',
            ],
        ));
    });

    it('should parse negated in expression', () => {
        const output = parser.parse('not(in(name, \'Peter\', \'Hans\'))');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.NOT_IN,
            'name',
            [
                'Peter',
                'Hans',
            ],
        ));
    });

    it('should parse nin expression', () => {
        const output = parser.parse('nin(name, \'Peter\', \'Hans\')');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.NOT_IN,
            'name',
            [
                'Peter',
                'Hans',
            ],
        ));
    });

    it('should parse negated nin expression', () => {
        const output = parser.parse('not(nin(name, \'Peter\', \'Hans\'))');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.IN,
            'name',
            [
                'Peter',
                'Hans',
            ],
        ));
    });

    it('should parse nested expression', () => {
        const output = parser.parse('and(eq(user.friends, \'5\'), contains(user.name, \'Bob\'))');

        expect(output).toEqual(new Filters(
            FilterCompoundOperator.AND,
            [
                new Filter(
                    FilterFieldOperator.EQUAL,
                    'user.friends',
                    5,
                ),
                new Filter(
                    FilterFieldOperator.CONTAINS,
                    'user.name',
                    'Bob',
                ),
            ],
        ));
    });

    it('should negated nested expression', () => {
        const output = parser.parse('not(and(eq(name, \'foo\'), lt(age, \'15\')))');

        expect(output).toEqual(new Filters(
            FilterCompoundOperator.OR,
            [
                new Filter(
                    FilterFieldOperator.NOT_EQUAL,
                    'name',
                    'foo',
                ),
                new Filter(
                    FilterFieldOperator.GREATER_THAN_EQUAL,
                    'age',
                    15,
                ),
            ],
        ));
    });
});
