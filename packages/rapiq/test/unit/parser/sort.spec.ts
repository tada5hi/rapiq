/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IInterpreter, Sorts } from '../../../src';
import {
    Relation,
    Relations,
    SimpleSortParser,
    SortDirection,
    SortParseError, defineSortSchema,
} from '../../../src';
import type { User } from '../../data';
import { registry } from '../../data/schema';

class SortSimpleInterpreter implements IInterpreter<Sorts, Record<string, `${SortDirection}`>> {
    interpret(input: Sorts): Record<string, `${SortDirection}`> {
        const output : Record<string, `${SortDirection}`> = {};

        for (let i = 0; i < input.value.length; i++) {
            output[input.value[i].name] = input.value[i].operator as SortDirection;
        }

        return output;
    }
}

describe('src/sort/index.ts', () => {
    let parser : SimpleSortParser;
    let interpreter : SortSimpleInterpreter;

    beforeAll(() => {
        parser = new SimpleSortParser(registry);
        interpreter = new SortSimpleInterpreter();
    });

    it('should parse sort data', async () => {
        // sort asc
        const transformed = parser.parse('id', {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.ASC });
    });

    it('should parse with desc prefix (-)', async () => {
        // sort desc
        const transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.DESC });
    });

    it('should not parse with invalid field name', async () => {
        // invalid field names
        const transformed = parser.parse('-!id');
        expect(interpreter.interpret(transformed)).toEqual({});
    });

    it('should ignore invalid field name', async () => {
        // ignore field name pattern, if permitted by allowed key
        const transformed = parser.parse(['-!id'], {
            schema: defineSortSchema({
                allowed: ['!id'],
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({ '!id': SortDirection.DESC });
    });

    it('should parse with empty allowed', async () => {
        // empty allowed
        const transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: [],
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({});
    });

    it('should parse with undefined allowed', async () => {
        // undefined allowed
        const transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: undefined,
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.DESC });
    });

    it('should parse with only default', async () => {
        // only default
        const transformed = parser.parse('name', {
            schema: defineSortSchema({
                default: { name: 'DESC' },
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({ name: SortDirection.ASC });
    });

    it('should parse with only default and desc', async () => {
        // only default with no match
        const transformed = parser.parse('-id', {
            schema: defineSortSchema({
                default: { name: 'DESC' },
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({
            name: SortDirection.DESC,
        });
    });

    it('should not parse with wrong allowed', async () => {
        // wrong allowed
        const transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: ['a'],
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({});
    });

    it('should parse array input', async () => {
        // array data
        const transformed = parser.parse(['-id'], {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.DESC });
    });

    it('should parse object input', async () => {
        // object data
        const transformed = parser.parse({ id: 'ASC' }, {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.ASC });
    });

    it('should not parse invalid input data', async () => {
        // wrong input data data
        const transformed = parser.parse({ id: 'Right' }, {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({});
    });

    it('should parse with field alias', async () => {
        // with query alias
        const transformed = parser.parse('-alias', {
            schema: defineSortSchema({
                allowed: ['id'],
                mapping: {
                    alias: 'id',
                },
            }),
        });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.DESC });
    });

    it('should transform sort with default', async () => {
        const schema = defineSortSchema<{
            id: number,
            name: string,
            role: {id: number}
        }>({
            allowed: ['id', 'name'],
            default: {
                id: 'DESC',
            },
        });

        let transformed = parser.parse(['id'], { schema });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.ASC });

        transformed = parser.parse(undefined, { schema });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.DESC });

        transformed = parser.parse([], { schema });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.DESC });

        transformed = parser.parse('-age', { schema });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.DESC });
    });

    it('should parse sort with sort indexes (simple)', async () => {
        const schema = defineSortSchema<User>({
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
        });

        // simple
        const transformed = parser.parse(['id'], { schema });
        expect(interpreter.interpret(transformed)).toEqual({ id: SortDirection.ASC });
    });

    it('should parse sort with sort indexes (tuple)', async () => {
        const schema = defineSortSchema<User>({
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
        });

        // correct order
        let transformed = parser.parse(['name', 'email'], { schema });
        expect(interpreter.interpret(transformed)).toStrictEqual({
            name: SortDirection.ASC,
            email: SortDirection.ASC,
        });

        // incorrect order
        transformed = parser.parse(['email', 'name'], { schema });
        expect(interpreter.interpret(transformed)).toStrictEqual({
            name: SortDirection.ASC,
            email: SortDirection.ASC,
        });

        // no match
        transformed = parser.parse(['email'], { schema });
        expect(interpreter.interpret(transformed)).toStrictEqual({});
    });

    it('should parse sort with sort indexes & default path', async () => {
        const schema = defineSortSchema<User>({
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
            name: 'user',
        });

        // incomplete match
        const transformed = parser.parse(['email', 'id'], { schema });
        expect(interpreter.interpret(transformed)).toStrictEqual({
            id: SortDirection.ASC,
        });
    });

    it('should parse with simple relation', async () => {
        const transformed = parser.parse(['id', 'realm.id'], {
            schema: 'user',
            relations: new Relations([
                new Relation('realm'),
            ]),
        });
        expect(interpreter.interpret(transformed)).toEqual({
            id: SortDirection.ASC,
            'realm.id': SortDirection.ASC,
        });
    });

    it('should parse with nested relation', async () => {
        // with deep nested include
        const transformed = parser.parse(['id', 'items.realm.id'], {
            schema: 'user',
            relations: new Relations([
                new Relation('items'),
                new Relation('items.realm'),
            ]),
            throwOnFailure: true,
        });

        expect(interpreter.interpret(transformed)).toEqual({
            id: SortDirection.ASC,
            'items.realm.id': SortDirection.ASC,
        });
    });

    it('should throw on invalid input', async () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
        });

        const error = SortParseError.inputInvalid();

        expect(() => parser.parse(false, { schema })).toThrow(error);
    });

    it('should throw on invalid key', async () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
        });

        const error = SortParseError.keyInvalid('1foo');
        expect(() => parser.parse({
            '1foo': 'desc',
        }, { schema })).toThrow(error);
    });

    it('should throw on non allowed relation', async () => {
        const error = SortParseError.keyPathInvalid('bar');

        expect(() => parser.parse({
            'bar.bar': 'desc',
        }, {
            schema: 'user',
            relations: new Relations([
                new Relation('realm'),
            ]),
            throwOnFailure: true,
        })).toThrow(error.message);
    });

    it('should throw on non allowed key which is not covered by a relation', async () => {
        const error = SortParseError.keyNotPermitted('description');

        expect(() => parser.parse({
            'realm.description': 'desc',
        }, {
            schema: 'user',
            relations: new Relations([
                new Relation('realm'),
            ]),
            throwOnFailure: true,
        })).toThrow(error);
    });

    it('should throw on invalid key value', async () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
            allowed: ['foo'],
        });

        const error = SortParseError.inputInvalid();

        expect(() => parser.parse({
            bar: 1,
        }, {
            schema,
        })).toThrow(error);
    });

    it('should throw on non allowed key', async () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
            allowed: ['foo'],
        });

        const error = SortParseError.keyNotPermitted('bar');

        expect(() => parser.parse({
            bar: 'desc',
        }, { schema })).toThrow(error);
    });
});
