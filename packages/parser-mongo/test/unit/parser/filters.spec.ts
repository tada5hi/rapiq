/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FiltersParseOptions } from '@rapiq/core';
import {
    ErrorCode,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    FiltersParseError,
    Relation,
    Relations,
    SchemaRegistry,
    defineFiltersSchema,
    defineSchema,
} from '@rapiq/core';
import { registry } from '../../data/schema';
import type { Entity, User } from '../../data/type';
import { MongoFiltersParser } from '../../../src';

describe('filters/mongo-parser', () => {
    let parser : MongoFiltersParser;

    const parseFlat = (input: unknown, options: FiltersParseOptions = {}) => {
        const output = parser.parse(input, options);
        if (output.value.length === 1) {
            return output.value[0];
        }

        return output;
    };

    const expectParseError = (fn: () => unknown, code: ErrorCode) => {
        let error : unknown;
        try {
            fn();
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(FiltersParseError);
        expect((error as FiltersParseError).code).toEqual(code);
    };

    beforeAll(() => {
        parser = new MongoFiltersParser();
    });

    describe('bare values (desugar)', () => {
        it('should wrap a bare string condition in a root AND group', () => {
            const output = parser.parse({ name: 'admin' });

            expect(output).toEqual(new Filters(
                FilterCompoundOperator.AND,
                [new Filter(FilterFieldOperator.EQUAL, 'name', 'admin')],
            ));
        });

        it('should parse bare scalars and null as equal conditions', () => {
            expect(parseFlat({ age: 18 }))
                .toEqual(new Filter(FilterFieldOperator.EQUAL, 'age', 18));
            expect(parseFlat({ flag: true }))
                .toEqual(new Filter(FilterFieldOperator.EQUAL, 'flag', true));
            expect(parseFlat({ id: null }))
                .toEqual(new Filter(FilterFieldOperator.EQUAL, 'id', null));
        });

        it('should pass a bare Date through as an equal condition', () => {
            const date = new Date('2026-01-01T00:00:00.000Z');

            const output = parseFlat({ created_at: date });

            expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'created_at', date));
            expect((output as Filter).value).toBe(date);
        });

        it('should parse a bare RegExp as a regex condition', () => {
            const output = parseFlat({ name: /^adm/i });

            expect(output).toEqual(new Filter(FilterFieldOperator.REGEX, 'name', /^adm/i));
        });

        it('should parse a bare array as an in condition including null elements', () => {
            const output = parseFlat({ id: [1, '2', null] });

            expect(output).toEqual(new Filter(FilterFieldOperator.IN, 'id', [1, '2', null]));
        });

        it('should throw on an empty bare array', () => {
            expectParseError(() => parser.parse({ id: [] }), ErrorCode.KEY_VALUE_INVALID);
        });

        it('should throw on a RegExp element inside a bare array', () => {
            expectParseError(() => parser.parse({ id: [/x/] }), ErrorCode.KEY_VALUE_INVALID);
        });

        it('should throw on an unsupported bare value', () => {
            expectParseError(() => parser.parse({ id: undefined }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ id: () => {} }), ErrorCode.KEY_VALUE_INVALID);
        });

        it('should always throw on an empty object value', () => {
            expectParseError(() => parser.parse({ id: {} }), ErrorCode.KEY_VALUE_INVALID);
        });
    });

    describe('operator objects', () => {
        it('should parse eq & ne operators', () => {
            expect(parseFlat({ name: { $eq: 'admin' } }))
                .toEqual(new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'));
            expect(parseFlat({ name: { $eq: null } }))
                .toEqual(new Filter(FilterFieldOperator.EQUAL, 'name', null));
            expect(parseFlat({ name: { $ne: 'admin' } }))
                .toEqual(new Filter(FilterFieldOperator.NOT_EQUAL, 'name', 'admin'));
        });

        it('should throw on invalid eq & ne values', () => {
            expectParseError(() => parser.parse({ name: { $eq: [1] } }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ name: { $eq: /x/ } }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ name: { $ne: { nested: true } } }), ErrorCode.KEY_VALUE_INVALID);
        });

        it('should parse the ordering operators', () => {
            const date = new Date('2026-01-01T00:00:00.000Z');

            expect(parseFlat({ age: { $lt: 65 } }))
                .toEqual(new Filter(FilterFieldOperator.LESS_THAN, 'age', 65));
            expect(parseFlat({ age: { $lte: 65 } }))
                .toEqual(new Filter(FilterFieldOperator.LESS_THAN_EQUAL, 'age', 65));
            expect(parseFlat({ age: { $gt: 18 } }))
                .toEqual(new Filter(FilterFieldOperator.GREATER_THAN, 'age', 18));
            expect(parseFlat({ age: { $gte: 18 } }))
                .toEqual(new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 18));
            expect(parseFlat({ created_at: { $lt: date } }))
                .toEqual(new Filter(FilterFieldOperator.LESS_THAN, 'created_at', date));
        });

        it('should throw on non orderable values for the ordering operators', () => {
            expectParseError(() => parser.parse({ age: { $lt: null } }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ age: { $lte: true } }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ age: { $gt: null } }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ age: { $gte: false } }), ErrorCode.KEY_VALUE_INVALID);
        });

        it('should parse in & nin operators', () => {
            expect(parseFlat({ id: { $in: [1, null] } }))
                .toEqual(new Filter(FilterFieldOperator.IN, 'id', [1, null]));
            expect(parseFlat({ id: { $nin: ['a', 'b'] } }))
                .toEqual(new Filter(FilterFieldOperator.NOT_IN, 'id', ['a', 'b']));
        });

        it('should throw on invalid in & nin values', () => {
            expectParseError(() => parser.parse({ id: { $in: [] } }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ id: { $in: 'a' } }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ id: { $nin: [/x/] } }), ErrorCode.KEY_VALUE_INVALID);
        });

        it('should parse the string extension operators', () => {
            const cases : [string, `${FilterFieldOperator}`][] = [
                ['$startsWith', FilterFieldOperator.STARTS_WITH],
                ['$notStartsWith', FilterFieldOperator.NOT_STARTS_WITH],
                ['$endsWith', FilterFieldOperator.ENDS_WITH],
                ['$notEndsWith', FilterFieldOperator.NOT_ENDS_WITH],
                ['$contains', FilterFieldOperator.CONTAINS],
                ['$notContains', FilterFieldOperator.NOT_CONTAINS],
            ];

            for (const [key, operator] of cases) {
                expect(parseFlat({ name: { [key]: 'Pe' } }))
                    .toEqual(new Filter(operator, 'name', 'Pe'));
            }
        });

        it('should throw on non string values for the string extension operators', () => {
            const keys = [
                '$startsWith',
                '$notStartsWith',
                '$endsWith',
                '$notEndsWith',
                '$contains',
                '$notContains',
            ];

            for (const key of keys) {
                expectParseError(() => parser.parse({ name: { [key]: 5 } }), ErrorCode.KEY_VALUE_INVALID);
            }
        });

        it('should parse the mod operator', () => {
            expect(parseFlat({ age: { $mod: [3, 1] } }))
                .toEqual(new Filter(FilterFieldOperator.MOD, 'age', [3, 1]));
        });

        it('should throw on invalid mod values', () => {
            expectParseError(() => parser.parse({ age: { $mod: [0, 1] } }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ age: { $mod: [3] } }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ age: { $mod: ['3', 1] } }), ErrorCode.KEY_VALUE_INVALID);
            expectParseError(() => parser.parse({ age: { $mod: 3 } }), ErrorCode.KEY_VALUE_INVALID);
        });

        it('should parse the exists operator', () => {
            expect(parseFlat({ deleted: { $exists: true } }))
                .toEqual(new Filter(FilterFieldOperator.EXISTS, 'deleted', true));
            expect(parseFlat({ deleted: { $exists: false } }))
                .toEqual(new Filter(FilterFieldOperator.EXISTS, 'deleted', false));
        });

        it('should throw on a non boolean exists value', () => {
            expectParseError(() => parser.parse({ deleted: { $exists: 'yes' } }), ErrorCode.KEY_VALUE_INVALID);
        });

        it('should combine a multi operator object with an implicit AND', () => {
            const output = parser.parse({ age: { $gte: 18, $lt: 65 } });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 18),
                new Filter(FilterFieldOperator.LESS_THAN, 'age', 65),
            ]));
        });

        it('should throw on an unknown operator at field level', () => {
            expectParseError(() => parser.parse({ age: { $foo: 1 } }), ErrorCode.SYNTAX_INVALID);
        });

        it('should throw on a known but unsupported operator at field level', () => {
            const error = FiltersParseError.operatorUnsupported('$size');

            expect(() => parser.parse({ items: { $size: 2 } })).toThrow(error);

            expectParseError(() => parser.parse({ age: { $type: 'number' } }), ErrorCode.OPERATOR_UNSUPPORTED);
        });

        it('should throw on a compound operator at field level', () => {
            expectParseError(
                () => parser.parse({ age: { $or: [{ $gte: 3 }] } }),
                ErrorCode.SYNTAX_INVALID,
            );
        });
    });

    describe('$regex & $options', () => {
        it('should parse a RegExp valued $regex', () => {
            const output = parseFlat({ name: { $regex: /foo/i } });

            expect(output).toEqual(new Filter(FilterFieldOperator.REGEX, 'name', /foo/i));
        });

        it('should parse a string valued $regex into a RegExp instance', () => {
            const output = parseFlat({ name: { $regex: 'foo' } });

            expect(output).toEqual(new Filter(FilterFieldOperator.REGEX, 'name', /foo/));
            expect((output as Filter).value).toBeInstanceOf(RegExp);
        });

        it('should apply $options as RegExp flags', () => {
            expect(parseFlat({ name: { $regex: 'foo', $options: 'i' } }))
                .toEqual(new Filter(FilterFieldOperator.REGEX, 'name', /foo/i));

            // key order must not matter.
            expect(parseFlat({ name: { $options: 'i', $regex: 'foo' } }))
                .toEqual(new Filter(FilterFieldOperator.REGEX, 'name', /foo/i));
        });

        it('should throw on a dangling $options', () => {
            expectParseError(() => parser.parse({ name: { $options: 'i' } }), ErrorCode.SYNTAX_INVALID);
        });

        it('should throw on $options beside a RegExp valued $regex', () => {
            expectParseError(
                () => parser.parse({ name: { $regex: /foo/, $options: 'i' } }),
                ErrorCode.SYNTAX_INVALID,
            );
        });

        it('should throw on an invalid pattern', () => {
            expectParseError(() => parser.parse({ name: { $regex: '[' } }), ErrorCode.KEY_VALUE_INVALID);
        });

        it('should throw on invalid flags', () => {
            expectParseError(
                () => parser.parse({ name: { $regex: 'foo', $options: 'x' } }),
                ErrorCode.KEY_VALUE_INVALID,
            );
        });

        it('should throw on a non string, non RegExp $regex value', () => {
            expectParseError(() => parser.parse({ name: { $regex: 5 } }), ErrorCode.KEY_VALUE_INVALID);
        });

        it('should throw on a non string $options value', () => {
            expectParseError(
                () => parser.parse({ name: { $regex: 'foo', $options: 5 } }),
                ErrorCode.KEY_VALUE_INVALID,
            );
        });
    });

    describe('compounds', () => {
        it('should materialize a root $and without unwrapping a single child', () => {
            const output = parser.parse({ $and: [{ name: 'a' }] });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'a'),
            ]));
        });

        it('should return a root $or as the root compound', () => {
            const output = parser.parse({ $or: [{ name: 'a' }, { name: 'b' }] });

            expect(output).toEqual(new Filters(FilterCompoundOperator.OR, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'a'),
                new Filter(FilterFieldOperator.EQUAL, 'name', 'b'),
            ]));
        });

        it('should preserve nested compound structure without flattening', () => {
            const output = parser.parse({
                $or: [
                    { $and: [{ a: 1 }, { b: 2 }] },
                    { c: 3 },
                ],
            });

            expect(output).toEqual(new Filters(FilterCompoundOperator.OR, [
                new Filters(FilterCompoundOperator.AND, [
                    new Filter(FilterFieldOperator.EQUAL, 'a', 1),
                    new Filter(FilterFieldOperator.EQUAL, 'b', 2),
                ]),
                new Filter(FilterFieldOperator.EQUAL, 'c', 3),
            ]));
        });

        it('should combine plain keys and compounds with an implicit AND', () => {
            const output = parser.parse({
                status: 'active',
                $or: [{ a: 1 }, { b: 2 }],
            });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
                new Filters(FilterCompoundOperator.OR, [
                    new Filter(FilterFieldOperator.EQUAL, 'a', 1),
                    new Filter(FilterFieldOperator.EQUAL, 'b', 2),
                ]),
            ]));
        });

        it('should combine multiple document entries with an implicit AND', () => {
            const output = parser.parse({ name: 'a', age: 18 });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'a'),
                new Filter(FilterFieldOperator.EQUAL, 'age', 18),
            ]));
        });

        it('should resolve dotted keys inside compound children', () => {
            const output = parser.parse({ $or: [{ 'realm.name': 'x' }, { name: 'y' }] });

            expect(output).toEqual(new Filters(FilterCompoundOperator.OR, [
                new Filter(FilterFieldOperator.EQUAL, 'realm.name', 'x'),
                new Filter(FilterFieldOperator.EQUAL, 'name', 'y'),
            ]));
        });

        it('should desugar $nor to an AND of negated children', () => {
            const output = parser.parse({ $nor: [{ name: 'a' }, { age: { $gt: 5 } }] });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.NOT_EQUAL, 'name', 'a'),
                new Filter(FilterFieldOperator.LESS_THAN_EQUAL, 'age', 5),
            ]));
        });

        it('should apply De Morgan to a multi entry $nor child', () => {
            const output = parser.parse({ $nor: [{ name: 'a', age: 5 }] });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filters(FilterCompoundOperator.OR, [
                    new Filter(FilterFieldOperator.NOT_EQUAL, 'name', 'a'),
                    new Filter(FilterFieldOperator.NOT_EQUAL, 'age', 5),
                ]),
            ]));
        });

        it('should flip a nested compound under $nor', () => {
            const output = parser.parse({ $nor: [{ $or: [{ a: 1 }, { b: 2 }] }] });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filters(FilterCompoundOperator.AND, [
                    new Filter(FilterFieldOperator.NOT_EQUAL, 'a', 1),
                    new Filter(FilterFieldOperator.NOT_EQUAL, 'b', 2),
                ]),
            ]));
        });

        it('should cancel the negation of a $nor inside a $nor', () => {
            const output = parser.parse({ $nor: [{ $nor: [{ a: 1 }] }] });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filters(FilterCompoundOperator.OR, [
                    new Filter(FilterFieldOperator.EQUAL, 'a', 1),
                ]),
            ]));
        });

        it('should throw on an empty compound array', () => {
            expectParseError(() => parser.parse({ $and: [] }), ErrorCode.SYNTAX_INVALID);
        });

        it('should throw on a non array compound value', () => {
            expectParseError(() => parser.parse({ $and: { name: 'a' } }), ErrorCode.SYNTAX_INVALID);
        });

        it('should throw on a non object compound child', () => {
            expectParseError(() => parser.parse({ $and: [1] }), ErrorCode.SYNTAX_INVALID);
        });

        it('should throw on an empty object compound child', () => {
            expectParseError(() => parser.parse({ $and: [{}] }), ErrorCode.SYNTAX_INVALID);
        });
    });

    describe('$not', () => {
        it('should negate operators via $not', () => {
            expect(parseFlat({ name: { $not: { $eq: 'a' } } }))
                .toEqual(new Filter(FilterFieldOperator.NOT_EQUAL, 'name', 'a'));
            expect(parseFlat({ age: { $not: { $gte: 18 } } }))
                .toEqual(new Filter(FilterFieldOperator.LESS_THAN, 'age', 18));
            expect(parseFlat({ age: { $not: { $lt: 18 } } }))
                .toEqual(new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 18));
            expect(parseFlat({ name: { $not: { $in: ['a'] } } }))
                .toEqual(new Filter(FilterFieldOperator.NOT_IN, 'name', ['a']));
            expect(parseFlat({ name: { $not: { $contains: 'a' } } }))
                .toEqual(new Filter(FilterFieldOperator.NOT_CONTAINS, 'name', 'a'));
            expect(parseFlat({ name: { $not: { $startsWith: 'a' } } }))
                .toEqual(new Filter(FilterFieldOperator.NOT_STARTS_WITH, 'name', 'a'));
            expect(parseFlat({ deleted: { $not: { $exists: true } } }))
                .toEqual(new Filter(FilterFieldOperator.EXISTS, 'deleted', false));
        });

        it('should combine a multi operator $not with a local OR', () => {
            const output = parser.parse({ age: { $not: { $gte: 18, $lt: 5 } } });

            expect(output).toEqual(new Filters(FilterCompoundOperator.OR, [
                new Filter(FilterFieldOperator.LESS_THAN, 'age', 18),
                new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 5),
            ]));
        });

        it('should keep the local OR of a multi operator $not as one condition of the document', () => {
            const output = parser.parse({
                name: 'a',
                age: { $not: { $gte: 18, $lt: 5 } },
            });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'a'),
                new Filters(FilterCompoundOperator.OR, [
                    new Filter(FilterFieldOperator.LESS_THAN, 'age', 18),
                    new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 5),
                ]),
            ]));
        });

        it('should throw on a nested $not', () => {
            expectParseError(
                () => parser.parse({ age: { $not: { $not: { $eq: 1 } } } }),
                ErrorCode.SYNTAX_INVALID,
            );
        });

        it('should throw on $not under $nor', () => {
            expectParseError(
                () => parser.parse({ $nor: [{ age: { $not: { $eq: 1 } } }] }),
                ErrorCode.SYNTAX_INVALID,
            );
        });

        it('should throw on the $not RegExp shorthand', () => {
            const error = FiltersParseError.operatorUnsupported('$regex');

            expect(() => parser.parse({ name: { $not: /a/ } })).toThrow(error);
        });

        it('should throw on non negatable operators under $not', () => {
            expectParseError(
                () => parser.parse({ name: { $not: { $regex: 'a' } } }),
                ErrorCode.OPERATOR_UNSUPPORTED,
            );
            expectParseError(
                () => parser.parse({ age: { $not: { $mod: [3, 1] } } }),
                ErrorCode.OPERATOR_UNSUPPORTED,
            );
            expectParseError(
                () => parser.parse({ items: { $not: { $elemMatch: { id: 1 } } } }),
                ErrorCode.OPERATOR_UNSUPPORTED,
            );
        });

        it('should always throw on an empty $not object', () => {
            expectParseError(() => parser.parse({ age: { $not: {} } }), ErrorCode.SYNTAX_INVALID);
        });

        it('should throw on a non object $not value', () => {
            expectParseError(() => parser.parse({ age: { $not: 5 } }), ErrorCode.SYNTAX_INVALID);
        });

        it('should throw on non negatable operators under $nor', () => {
            expectParseError(
                () => parser.parse({ $nor: [{ age: { $mod: [3, 1] } }] }),
                ErrorCode.OPERATOR_UNSUPPORTED,
            );
            expectParseError(
                () => parser.parse({ $nor: [{ name: { $regex: 'a' } }] }),
                ErrorCode.OPERATOR_UNSUPPORTED,
            );
            expectParseError(
                () => parser.parse({ $nor: [{ name: /a/ }] }),
                ErrorCode.OPERATOR_UNSUPPORTED,
            );
        });

        it('should negate a bare array under $nor to a not in condition', () => {
            const output = parser.parse({ $nor: [{ id: [1, 2] }] });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.NOT_IN, 'id', [1, 2]),
            ]));
        });

        it('should flip an exists condition under $nor', () => {
            const output = parser.parse({ $nor: [{ deleted: { $exists: false } }] });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EXISTS, 'deleted', true),
            ]));
        });
    });

    describe('document grammar', () => {
        it('should throw on a field operator at document level', () => {
            expectParseError(() => parser.parse({ $gte: 3 }), ErrorCode.SYNTAX_INVALID);
        });

        it('should throw on a known but unsupported operator at document level', () => {
            const error = FiltersParseError.operatorUnsupported('$where');

            expect(() => parser.parse({ $where: 'this.a > 1' })).toThrow(error);
        });

        it('should throw on an unknown operator at document level', () => {
            expectParseError(() => parser.parse({ $foo: 1 }), ErrorCode.SYNTAX_INVALID);
        });

        it('should throw on non object top level input', () => {
            expectParseError(() => parser.parse(5), ErrorCode.INPUT_INVALID);
            expectParseError(() => parser.parse('foo'), ErrorCode.INPUT_INVALID);
            expectParseError(() => parser.parse([{ name: 'a' }]), ErrorCode.INPUT_INVALID);
        });

        it('should throw on deeply nested compounds instead of overflowing the stack', () => {
            let input : Record<string, any> = { name: 'admin' };
            for (let i = 0; i < 40; i++) {
                input = { $and: [input] };
            }

            expectParseError(() => parser.parse(input), ErrorCode.SYNTAX_INVALID);
        });

        it('should throw on deeply nested objects instead of overflowing the stack', () => {
            let input : Record<string, any> = { name: 'admin' };
            for (let i = 0; i < 40; i++) {
                input = { a: input };
            }

            expectParseError(() => parser.parse(input), ErrorCode.SYNTAX_INVALID);
        });

        it('should parse nesting below the depth cap', () => {
            let input : Record<string, any> = { name: 'admin' };
            for (let i = 0; i < 10; i++) {
                input = { $and: [input] };
            }

            expect(() => parser.parse(input)).not.toThrow();
        });
    });

    describe('path expansion (nested objects)', () => {
        it('should expand a nested object to a dotted key path', () => {
            const nested = parser.parse({ realm: { name: 'x' } });
            const dotted = parser.parse({ 'realm.name': 'x' });

            expect(nested).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'realm.name', 'x'),
            ]));
            expect(nested).toEqual(dotted);
        });

        it('should expand deeply nested objects', () => {
            const output = parseFlat({ a: { b: { c: { $gte: 3 } } } });

            expect(output).toEqual(new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'a.b.c', 3));
        });

        it('should expand multiple nested entries into an implicit AND', () => {
            const output = parser.parse({ realm: { id: 1, name: 'x' } });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'realm.id', 1),
                new Filter(FilterFieldOperator.EQUAL, 'realm.name', 'x'),
            ]));
        });

        it('should throw on mixed operator and field keys', () => {
            expectParseError(
                () => parser.parse({ realm: { name: 'x', $eq: 1 } }),
                ErrorCode.SYNTAX_INVALID,
            );
        });

        it('should throw on an empty object at a nested level', () => {
            expectParseError(() => parser.parse({ realm: { name: {} } }), ErrorCode.KEY_VALUE_INVALID);
        });
    });

    describe('parse (schema-constrained)', () => {
        let constrained : MongoFiltersParser;

        beforeAll(() => {
            constrained = new MongoFiltersParser(registry);
        });

        it('should parse an allowed key', () => {
            const output = constrained.parse({ name: 'admin' }, { schema: 'user' });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
            ]));
        });

        it('should drop a non allowed key silently', () => {
            const output = constrained.parse({ age: 18, name: 'admin' }, { schema: 'user' });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
            ]));
        });

        it('should throw on a non allowed key with throwOnFailure', () => {
            const error = FiltersParseError.keyNotPermitted('age');

            expect(() => constrained.parse({ age: 18 }, {
                schema: 'user',
                throwOnFailure: true,
            })).toThrow(error);
        });

        it('should throw on a non allowed key under a throwOnFailure schema', () => {
            const schema = defineFiltersSchema({
                allowed: ['id'],
                throwOnFailure: true,
            });
            const error = FiltersParseError.keyNotPermitted('name');

            expect(() => constrained.parse({ name: 'x' }, { schema })).toThrow(error);
        });

        it('should walk a relation path through schemaMapping', () => {
            const output = constrained.parse({ 'items.id': 1 }, { schema: 'user' });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'items.id', 1),
            ]));
        });

        it('should validate the leaf against the related schema', () => {
            const output = constrained.parse({ 'items.name': 'foo' }, { schema: 'user' });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, []));

            const error = FiltersParseError.keyNotPermitted('name');
            expect(() => constrained.parse({ 'items.name': 'foo' }, {
                schema: 'user',
                throwOnFailure: true,
            })).toThrow(error);
        });

        it('should honor the relations context', () => {
            const dropped = constrained.parse({ 'items.id': 1 }, {
                schema: 'user',
                relations: new Relations([new Relation('realm')]),
            });
            expect(dropped).toEqual(new Filters(FilterCompoundOperator.AND, []));

            const error = FiltersParseError.keyPathNotPermitted('items');
            expect(() => constrained.parse({ 'items.id': 1 }, {
                schema: 'user',
                relations: new Relations([new Relation('realm')]),
                throwOnFailure: true,
            })).toThrow(error);

            const output = constrained.parse({ 'items.id': 1 }, {
                schema: 'user',
                relations: new Relations([new Relation('items')]),
            });
            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'items.id', 1),
            ]));
        });

        it('should apply mapping aliases', () => {
            const schema = defineFiltersSchema({
                allowed: ['id'],
                mapping: { aliasId: 'id' },
            });

            const output = constrained.parse({ aliasId: 1 }, { schema });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            ]));
        });

        it('should throw on grammar errors before applying the field policy', () => {
            // age is not allowed and would drop — grammar still throws.
            expectParseError(
                () => constrained.parse({ age: { $foo: 1 } }, { schema: 'user' }),
                ErrorCode.SYNTAX_INVALID,
            );
            expectParseError(
                () => constrained.parse({ age: {} }, { schema: 'user' }),
                ErrorCode.KEY_VALUE_INVALID,
            );
            expectParseError(
                () => constrained.parse({ age: [] }, { schema: 'user' }),
                ErrorCode.KEY_VALUE_INVALID,
            );
        });

        it('should skip compound children dropped by the schema policy', () => {
            const output = constrained.parse({ $or: [{ age: 18 }, { name: 'a' }] }, { schema: 'user' });

            expect(output).toEqual(new Filters(FilterCompoundOperator.OR, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'a'),
            ]));
        });

        it('should drop a compound when all children are dropped', () => {
            const output = constrained.parse({ $or: [{ age: 18 }] }, { schema: 'user' });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, []));
        });
    });

    describe('schema defaults', () => {
        it('should apply schema defaults for absent input', () => {
            const schema = defineFiltersSchema({ default: new Filter(FilterFieldOperator.EQUAL, 'id', 1) });

            expect(parser.parse(undefined, { schema })).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            ]));
            expect(parser.parse(null, { schema })).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            ]));
        });

        it('should apply schema defaults for an empty document', () => {
            const schema = defineFiltersSchema({ default: new Filter(FilterFieldOperator.EQUAL, 'id', 1) });

            const output = parser.parse({}, { schema });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            ]));
        });

        it('should apply schema defaults when every condition is dropped', () => {
            const schema = defineFiltersSchema({
                allowed: ['id'],
                default: new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            });

            const output = parser.parse({ name: 'x' }, { schema });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            ]));
        });

        it('should short-circuit to defaults on an empty allow-list', () => {
            const schema = defineFiltersSchema({
                allowed: [],
                default: new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                throwOnFailure: true,
            });

            // the input is not walked — nothing throws despite the policy.
            const output = parser.parse({ name: 'x' }, { schema });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            ]));
        });
    });

    describe('schema validation', () => {
        it('should replace and reject leaves without changing compound structure', () => {
            const schema = defineFiltersSchema({
                validate: (filter) => filter.field === 'name' ?
                    new Filter(filter.operator, filter.field, String(filter.value).toUpperCase()) :
                    undefined,
            });

            const output = parser.parse({ $or: [{ name: 'admin' }, { age: 18 }] }, { schema });

            expect(output).toEqual(new Filters(FilterCompoundOperator.OR, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'ADMIN'),
            ]));
        });

        it('should await an asynchronous schema validator through parseAsync', async () => {
            const schema = defineFiltersSchema({
                validate: async (filter) => filter.field === 'name' ?
                    new Filter(filter.operator, filter.field, String(filter.value).toUpperCase()) :
                    undefined,
            });

            const output = await parser.parseAsync(
                { $or: [{ name: 'admin' }, { age: 18 }] },
                { schema },
            );

            expect(output).toEqual(new Filters(FilterCompoundOperator.OR, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'ADMIN'),
            ]));
        });

        it('should apply schema defaults when validation rejects every filter', () => {
            const schema = defineFiltersSchema({
                default: new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
                validate: () => undefined,
            });

            const output = parser.parse({ name: 'admin' }, { schema });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
            ]));
        });

        it('should apply schema defaults when validation empties a nested compound', () => {
            const schema = defineFiltersSchema({
                default: new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
                validate: () => undefined,
            });

            const output = parser.parse(
                { $or: [{ $and: [{ name: 'admin' }] }] },
                { schema },
            );

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
            ]));
        });

        it('should validate the interior conditions of $elemMatch', () => {
            const schema = defineFiltersSchema({
                default: new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
                validate: (filter) => (filter.field === 'password' ? undefined : filter),
            });

            const output = parser.parse(
                { items: { $elemMatch: { password: 'x' } } },
                { schema },
            );

            // the interior leaf is rejected, dropping the whole
            // elemMatch condition — defaults apply.
            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
            ]));
        });
    });

    describe('strict mode', () => {
        it('should drop any key when parsing schemaless with the strict option', () => {
            const output = parser.parse({ name: 'x' }, { strict: true });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, []));
        });

        it('should throw for any key under strict with throwOnFailure', () => {
            const error = FiltersParseError.keyNotPermitted('name');

            expect(() => parser.parse({ name: 'x' }, {
                strict: true,
                throwOnFailure: true,
            })).toThrow(error);
        });

        it('should keep a declared allow-list working under strict', () => {
            const schema = defineFiltersSchema({
                allowed: ['name'],
                strict: true,
            });

            const output = parser.parse({ name: 'x' }, { schema });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'x'),
            ]));
        });
    });

    describe('$elemMatch', () => {
        let constrained : MongoFiltersParser;

        beforeAll(() => {
            const elemRegistry = new SchemaRegistry();
            elemRegistry.add(defineSchema({
                name: 'user',
                filters: { allowed: ['id', 'name', 'items', 'meta'] },
                schemaMapping: { items: 'item' },
            }));
            elemRegistry.add(defineSchema({
                name: 'item',
                filters: { allowed: ['id'] },
            }));

            constrained = new MongoFiltersParser(elemRegistry);
        });

        it('should parse the nested document form on a relation field', () => {
            const output = constrained.parse({ items: { $elemMatch: { id: 1 } } }, { schema: 'user' });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                ),
            ]));
        });

        it('should parse a nested elemMatch with element relative fields', () => {
            const output = parseFlat({ items: { $elemMatch: { parts: { $elemMatch: { id: 7 } } } } });

            expect(output).toEqual(new Filter(
                FilterFieldOperator.ELEM_MATCH,
                'items',
                new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'parts',
                    new Filter(FilterFieldOperator.EQUAL, 'id', 7),
                ),
            ));
        });

        it('should validate interior keys against the related schema', () => {
            const output = constrained.parse({ items: { $elemMatch: { name: 'x' } } }, { schema: 'user' });

            // the emptied interior drops the whole entry.
            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, []));

            const error = FiltersParseError.keyNotPermitted('name');
            expect(() => constrained.parse({ items: { $elemMatch: { name: 'x' } } }, { schema: 'user', throwOnFailure: true })).toThrow(error);
        });

        it('should combine a multi condition interior with an AND', () => {
            const output = parseFlat({ items: { $elemMatch: { id: 1, name: 'x' } } });

            expect(output).toEqual(new Filter(
                FilterFieldOperator.ELEM_MATCH,
                'items',
                new Filters(FilterCompoundOperator.AND, [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                    new Filter(FilterFieldOperator.EQUAL, 'name', 'x'),
                ]),
            ));
        });

        it('should keep an explicit compound interior as the condition', () => {
            const output = parseFlat({ items: { $elemMatch: { $or: [{ id: 1 }, { id: 2 }] } } });

            expect(output).toEqual(new Filter(
                FilterFieldOperator.ELEM_MATCH,
                'items',
                new Filters(FilterCompoundOperator.OR, [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                    new Filter(FilterFieldOperator.EQUAL, 'id', 2),
                ]),
            ));
        });

        it('should combine $elemMatch with sibling operators', () => {
            const output = parser.parse({
                items: {
                    $elemMatch: { id: 1 },
                    $exists: true,
                },
            });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                ),
                new Filter(FilterFieldOperator.EXISTS, 'items', true),
            ]));
        });

        it('should throw on the element operator form', () => {
            const error = FiltersParseError.featureUnsupported('$elemMatch (element-level operators)');

            expect(() => parser.parse({ items: { $elemMatch: { $gte: 5 } } })).toThrow(error);
            expect(() => parser.parse({ items: { $elemMatch: { $not: { $eq: 5 } } } })).toThrow(error);
        });

        it('should always throw on an empty $elemMatch object', () => {
            expectParseError(
                () => parser.parse({ items: { $elemMatch: {} } }),
                ErrorCode.KEY_VALUE_INVALID,
            );
        });

        it('should throw on a non object $elemMatch value', () => {
            expectParseError(
                () => parser.parse({ items: { $elemMatch: 5 } }),
                ErrorCode.KEY_VALUE_INVALID,
            );
        });

        it('should fall back to an unbound interior scope on a schemaless field', () => {
            const output = constrained.parse({ meta: { $elemMatch: { value: 5 } } }, { schema: 'user' });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'meta',
                    new Filter(FilterFieldOperator.EQUAL, 'value', 5),
                ),
            ]));

            // the missing related schema is never an error — not even
            // under throwOnFailure.
            const strictOutput = constrained.parse({ meta: { $elemMatch: { value: 5 } } }, { schema: 'user', throwOnFailure: true });

            expect(strictOutput).toEqual(output);
        });

        it('should honor the relations context', () => {
            const dropped = constrained.parse({ items: { $elemMatch: { id: 1 } } }, {
                schema: 'user',
                relations: new Relations([new Relation('realm')]),
            });
            expect(dropped).toEqual(new Filters(FilterCompoundOperator.AND, []));

            const error = FiltersParseError.keyPathNotPermitted('items');
            expect(() => constrained.parse({ items: { $elemMatch: { id: 1 } } }, {
                schema: 'user',
                relations: new Relations([new Relation('realm')]),
                throwOnFailure: true,
            })).toThrow(error);

            const output = constrained.parse({ items: { $elemMatch: { id: 1 } } }, {
                schema: 'user',
                relations: new Relations([new Relation('items')]),
            });
            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                ),
            ]));
        });

        it('should throw on a negated $elemMatch', () => {
            expectParseError(
                () => parser.parse({ $nor: [{ items: { $elemMatch: { id: 1 } } }] }),
                ErrorCode.OPERATOR_UNSUPPORTED,
            );
        });

        it('should reject unbound interior keys under a strict schema', () => {
            const schema = defineFiltersSchema({
                allowed: ['meta'],
                strict: true,
            });

            const output = constrained.parse({ meta: { $elemMatch: { value: 5 } } }, { schema });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, []));
        });

        it('should parse fully schemaless', () => {
            const output = parseFlat({ items: { $elemMatch: { name: 'x' } } });

            expect(output).toEqual(new Filter(
                FilterFieldOperator.ELEM_MATCH,
                'items',
                new Filter(FilterFieldOperator.EQUAL, 'name', 'x'),
            ));
        });
    });

    describe('parseTyped', () => {
        it('should delegate to parse', () => {
            const output = parser.parseTyped<User>({
                name: 'admin',
                age: { $gte: 18 },
            });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
                new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 18),
            ]));
        });

        it('should accept bare null and operator objects on a date field', () => {
            const date = new Date();

            const output = parser.parseTyped<Entity>({
                created_at: null,
                $or: [
                    { created_at: { $eq: null } },
                    { created_at: [date, null] },
                ],
            });

            expect(output).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'created_at', null),
                new Filters(FilterCompoundOperator.OR, [
                    new Filter(FilterFieldOperator.EQUAL, 'created_at', null),
                    new Filter(FilterFieldOperator.IN, 'created_at', [date, null]),
                ]),
            ]));
        });
    });
});
