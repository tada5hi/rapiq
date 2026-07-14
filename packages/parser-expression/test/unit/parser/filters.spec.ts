/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    FiltersParseError,
    Relation,
    Relations,
    defineFiltersSchema,
} from '@rapiq/core';
import { registry } from '../../data/schema';
import { ExpressionFiltersParser, ExpressionParser } from '../../../src';

describe('filters/expr-parser', () => {
    let parser : ExpressionFiltersParser;
    beforeAll(() => {
        parser = new ExpressionFiltersParser();
    });

    it('should parse eq expression', () => {
        const output = parser.parseExact('eq(name, \'admin\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'));
    });

    describe('parse (top-level wrapping)', () => {
        it('should wrap a single leaf condition in a root AND group', () => {
            const output = parser.parse('eq(name, \'admin\')');

            expect(output).toEqual(new Filters(
                FilterCompoundOperator.AND,
                [new Filter(FilterFieldOperator.EQUAL, 'name', 'admin')],
            ));
        });

        it('should return an existing compound group without re-wrapping it', () => {
            const output = parser.parse('and(eq(name, \'admin\'), eq(age, \'18\'))');

            // Must stay a single AND level — not Filters(AND, [Filters(AND, [...])]).
            expect(output).toEqual(new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
                    new Filter(FilterFieldOperator.EQUAL, 'age', 18),
                ],
            ));
        });

        it('should keep an OR group at the root without wrapping in AND', () => {
            const output = parser.parse('or(eq(name, \'admin\'), eq(name, \'guest\'))');

            expect(output.operator).toBe(FilterCompoundOperator.OR);
            expect(output.value).toHaveLength(2);
        });
    });

    it('should parse not eq expression', () => {
        const output = parser.parseExact('not(eq(name, \'admin\'))');

        expect(output).toEqual(new Filter(FilterFieldOperator.NOT_EQUAL, 'name', 'admin'));
    });

    it('should parse not not eq expression', () => {
        const output = parser.parseExact('not(not(eq(name, \'admin\')))');

        expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'));
    });

    it('should parse lt expression', () => {
        const output = parser.parseExact('lt(age, \'18\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.LESS_THAN, 'age', 18));
    });

    it('should parse lte expression', () => {
        const output = parser.parseExact('lte(age, \'18\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.LESS_THAN_EQUAL, 'age', 18));
    });

    it('should parse gt expression', () => {
        const output = parser.parseExact('gt(age, \'18\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.GREATER_THAN, 'age', 18));
    });

    it('should parse gte expression', () => {
        const output = parser.parseExact('gte(age, \'18\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 18));
    });

    it('should parse contains expression', () => {
        const output = parser.parseExact('contains(name, \'Peter\')');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.CONTAINS,
            'name',
            'Peter',
        ));
    });

    it('should parse startsWith expression', () => {
        const output = parser.parseExact('startsWith(name, \'Peter\')');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.STARTS_WITH,
            'name',
            'Peter',
        ));
    });

    it('should parse endsWith expression', () => {
        const output = parser.parseExact('endsWith(name, \'Peter\')');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.ENDS_WITH,
            'name',
            'Peter',
        ));
    });

    it('should parse negated contains expression', () => {
        const output = parser.parseExact('not(contains(name, \'Peter\'))');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.NOT_CONTAINS,
            'name',
            'Peter',
        ));
    });

    it('should parse negated startsWith expression', () => {
        const output = parser.parseExact('not(startsWith(name, \'Peter\'))');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.NOT_STARTS_WITH,
            'name',
            'Peter',
        ));
    });

    it('should parse negated endsWith expression', () => {
        const output = parser.parseExact('not(endsWith(name, \'Peter\'))');

        expect(output).toEqual(new Filter(
            FilterFieldOperator.NOT_ENDS_WITH,
            'name',
            'Peter',
        ));
    });

    it('should parse fields starting with a keyword prefix', () => {
        // "or", "not", "in", ... must not be split out of identifiers.
        let output = parser.parseExact('eq(order, \'asc\')');
        expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'order', 'asc'));

        output = parser.parseExact('eq(notes, \'foo\')');
        expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'notes', 'foo'));

        output = parser.parseExact('gt(inventory, \'5\')');
        expect(output).toEqual(new Filter(FilterFieldOperator.GREATER_THAN, 'inventory', 5));
    });

    it('should preserve a leading underscore in a field name', () => {
        const output = parser.parseExact('eq(_id, \'value\')');

        expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, '_id', 'value'));
    });

    it.each([
        '!eq(id, \'value\')',
        'eq(id, \'value\')!',
        'eq(id, \'value\') @',
    ])('should reject unmatched source characters in %s', (input) => {
        expect(() => parser.parseExact(input)).toThrow(FiltersParseError);

        try {
            parser.parseExact(input);
        } catch (error) {
            expect((error as FiltersParseError).code).toEqual(ErrorCode.SYNTAX_INVALID);
        }
    });

    it('should reject excessive nesting with a typed syntax error', () => {
        const input = `${'not('.repeat(40)}eq(id, 'value')${')'.repeat(40)}`;

        expect(() => parser.parseExact(input)).toThrow(FiltersParseError);

        try {
            parser.parseExact(input);
        } catch (error) {
            expect((error as FiltersParseError).code).toEqual(ErrorCode.SYNTAX_INVALID);
        }
    });

    it('should throw a typed error on invalid syntax', () => {
        let error : unknown;
        try {
            parser.parseExact('eq(name \'admin\')');
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(FiltersParseError);
        expect((error as FiltersParseError).code).toEqual(ErrorCode.SYNTAX_INVALID);
    });

    it('should apply schema defaults for absent input', () => {
        const schema = defineFiltersSchema({ default: new Filter(FilterFieldOperator.EQUAL, 'id', 1) });

        const output = parser.parse(undefined, { schema });

        expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'id', 1),
        ]));
    });

    it('should apply the schema validator without changing compound structure', () => {
        const schema = defineFiltersSchema({
            validate: (filter) => filter.field === 'name' ?
                new Filter(filter.operator, filter.field, String(filter.value).toUpperCase()) :
                undefined,
        });

        const output = parser.parse('or(eq(name, \'admin\'), eq(age, \'18\'))', { schema });

        expect(output).toEqual(new Filters(FilterCompoundOperator.OR, [
            new Filter(FilterFieldOperator.EQUAL, 'name', 'ADMIN'),
        ]));
    });

    it('should apply schema defaults when validation rejects every filter', () => {
        const schema = defineFiltersSchema({
            default: new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
            validate: () => undefined,
        });

        const output = parser.parse('eq(name, \'admin\')', { schema });

        expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
        ]));
    });

    it('should treat an empty string as invalid input, not as absent', () => {
        let error : unknown;
        try {
            parser.parse('');
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(FiltersParseError);
        expect((error as FiltersParseError).code).toEqual(ErrorCode.SYNTAX_INVALID);
    });

    it('should parse in expression', () => {
        const output = parser.parseExact('in(name, \'Peter\', \'Hans\')');

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
        const output = parser.parseExact('not(in(name, \'Peter\', \'Hans\'))');

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
        const output = parser.parseExact('nin(name, \'Peter\', \'Hans\')');

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
        const output = parser.parseExact('not(nin(name, \'Peter\', \'Hans\'))');

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
        const output = parser.parseExact('and(eq(user.friends, \'5\'), contains(user.name, \'Bob\'))');

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
        const output = parser.parseExact('not(and(eq(name, \'foo\'), lt(age, \'15\')))');

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

    describe('parse (schema-constrained)', () => {
        let constrained : ExpressionFiltersParser;
        beforeAll(() => {
            constrained = new ExpressionFiltersParser(registry);
        });

        it('should parse an allowed key', () => {
            const output = constrained.parseExact('eq(name, \'admin\')', { schema: 'user' });

            expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'));
        });

        it('should strip a leading segment matching the schema name', () => {
            const output = constrained.parseExact('eq(user.name, \'admin\')', { schema: 'user' });

            expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'));
        });

        it('should throw on a non allowed key', () => {
            const error = FiltersParseError.keyNotPermitted('age');

            expect(() => constrained.parseExact('eq(age, \'18\')', { schema: 'user' })).toThrow(error);
        });

        it('should walk a relation path through schemaMapping', () => {
            const output = constrained.parseExact('eq(items.id, \'1\')', { schema: 'user' });

            expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'items.id', 1));
        });

        it('should validate the leaf against the related schema', () => {
            const error = FiltersParseError.keyNotPermitted('name');

            expect(() => constrained.parseExact('eq(items.name, \'foo\')', { schema: 'user' })).toThrow(error);
        });

        it('should throw on an unresolvable relation segment', () => {
            const error = FiltersParseError.keyPathInvalid('foo');

            expect(() => constrained.parseExact('eq(foo.id, \'1\')', { schema: 'user' })).toThrow(error);
        });

        it('should honor the relations context', () => {
            const error = FiltersParseError.keyPathNotPermitted('items');

            expect(() => constrained.parseExact('eq(items.id, \'1\')', {
                schema: 'user',
                relations: new Relations([new Relation('realm')]),
            })).toThrow(error);

            const output = constrained.parseExact('eq(items.id, \'1\')', {
                schema: 'user',
                relations: new Relations([new Relation('items')]),
            });
            expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'items.id', 1));
        });

        it('should apply mapping aliases', () => {
            const schema = defineFiltersSchema({
                allowed: ['id'],
                mapping: { aliasId: 'id' },
            });
            const output = constrained.parseExact('eq(aliasId, \'1\')', { schema });

            expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'id', 1));
        });
    });

    describe('parse (strict mode)', () => {
        it('should throw for any key when parsing schemaless with the strict option', () => {
            const error = FiltersParseError.keyNotPermitted('name');

            expect(() => parser.parseExact('eq(name, \'admin\')', { strict: true })).toThrow(error);
        });

        it('should throw for undeclared keys under a strict schema', () => {
            const schema = defineFiltersSchema({ strict: true });
            const error = FiltersParseError.keyNotPermitted('name');

            expect(() => parser.parseExact('eq(name, \'admin\')', { schema })).toThrow(error);
        });

        it('should keep a declared allow-list working under strict', () => {
            const schema = defineFiltersSchema({
                allowed: ['name'],
                strict: true,
            });
            const output = parser.parseExact('eq(name, \'admin\')', { schema });

            expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'));
        });
    });

    describe('ExpressionParser (composite)', () => {
        it('should keep dotted fields when parsing without a schema', () => {
            const composite = new ExpressionParser();

            const output = composite.parse({ filters: 'eq(user.friends, \'5\')' });

            expect(output.filters).toEqual(new Filters(
                FilterCompoundOperator.AND,
                [new Filter(FilterFieldOperator.EQUAL, 'user.friends', 5)],
            ));
        });

        it('should reject undeclared parameters when parsing with the strict option', () => {
            const composite = new ExpressionParser();

            expect(() => composite.parse({ filters: 'eq(name, \'admin\')' }, { strict: true }))
                .toThrow(FiltersParseError.keyNotPermitted('name'));
        });
    });
});
