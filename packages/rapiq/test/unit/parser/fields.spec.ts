/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type {
    Fields,
    IInterpreter, ObjectLiteral,
} from '../../../src';
import {
    FieldsParseError,
    Relation,
    Relations,
    SimpleFieldsParser,
    defineFieldsSchema, defineSchema,
} from '../../../src';
import { registry } from '../../data/schema';

class FieldsSimpleInterpreter implements IInterpreter<Fields, string[]> {
    interpret(input: Fields): string[] {
        return input.value.map((input) => input.name);
    }
}

describe('src/fields/index.ts', () => {
    let parser : SimpleFieldsParser;
    let interpreter : FieldsSimpleInterpreter;

    beforeAll(() => {
        parser = new SimpleFieldsParser(registry);
        interpreter = new FieldsSimpleInterpreter();
    });

    it('should parse fields with name', async () => {
        const schema = defineSchema({
            name: 'user',
            fields: {
                allowed: ['id', 'name', 'email'],
            },
        });

        const data = parser.parse([], {
            schema,
        });

        expect(interpreter.interpret(data)).toEqual([
            'id',
            'name',
            'email',
        ]);
    });

    it('should parse fields with extra field', async () => {
        const schema = defineFieldsSchema({
            allowed: ['id', 'name', 'email'],
            name: 'user',
        });

        const data = parser.parse('+email', {
            schema,
        });
        expect(interpreter.interpret(data)).toEqual(['email']);
    });

    it('should parse with invalid input (with default)', async () => {
        const schema = defineSchema({
            fields: { default: ['id'] },
        });
        const data = parser.parse('name', {
            schema,
        });
        expect(interpreter.interpret(data)).toEqual(['id']);
    });

    it('should parse invalid input (with allowed)', async () => {
        const schema = defineSchema({
            fields: {
                allowed: ['id', 'name'],
            },
        });

        // fields undefined
        const data = parser.parse(undefined, { schema });
        expect(interpreter.interpret(data)).toEqual(['id', 'name']);
    });

    it('should parse with no schema', async () => {
        // no options
        let data = parser.parse(['id']);
        expect(interpreter.interpret(data)).toEqual(['id']);

        // invalid field names
        data = parser.parse(['"id', 'name!']);
        expect(interpreter.interpret(data)).toEqual([]);
    });

    it('should parse with invalid field pattern, if permitted by allowed', async () => {
        const schema = defineSchema({
            fields: {
                allowed: ['name!'],
            },
        });

        const data = parser.parse(['name!'], { schema });
        expect(interpreter.interpret(data)).toEqual(['name!']);
    });

    it('should not parse with empty allowed', async () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                allowed: [],
            },
        });

        let data = parser.parse(['id'], { schema });
        expect(interpreter.interpret(data)).toEqual([]);

        data = parser.parse('id', { schema });
        expect(interpreter.interpret(data)).toEqual([]);
    });

    it('should not parse with empty default', async () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                default: [],
            },
        });

        const data = parser.parse(['id'], { schema });
        expect(interpreter.interpret(data)).toEqual([]);
    });

    it('should parse invalid input (with allowed & default)', async () => {
        const schema = defineFieldsSchema({
            allowed: ['id', 'name'],
            default: ['id'],
        });

        // fields undefined with default
        let data = parser.parse(undefined, { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);

        // fields as array
        data = parser.parse(['id'], { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);

        // fields as string
        data = parser.parse('id', { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);

        // multiple fields but only one valid field
        data = parser.parse(['id', 'avatar'], { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);

        // field as string and append fields
        data = parser.parse('+id', { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);

        data = parser.parse('avatar,+id', { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);

        data = parser.parse('-id', { schema });
        expect(interpreter.interpret(data)).toEqual([]);

        // fields as string and append fields
        data = parser.parse('id,+name', { schema });
        expect(interpreter.interpret(data)).toEqual(['id', 'name']);

        // field not allowed
        data = parser.parse('avatar', { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);

        // field with invalid value
        data = parser.parse({ id: null }, { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);
    });

    it('should parse with single allowed domain', async () => {
        const schema = defineSchema({
            name: 'domain',
            fields: {
                allowed: ['id'],
            },
        });

        // if only one domain is given, try to parse request field to single domain.
        const data = parser.parse(['id'], { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);
    });

    it('should parse with multiple allowed domains', async () => {
        const schema = defineSchema({
            name: 'domain',
            fields: {
                allowed: ['id', 'name'],
            },
        });

        // if multiple possibilities are available for request field, use allowed
        const data = parser.parse(['id'], { schema });
        expect(interpreter.interpret(data)).toEqual([
            'id',
        ]);
    });

    it('should use default fields if default & allowed', async () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                default: ['name'],
                allowed: ['id'],
            },
        });

        let data = parser.parse(['id'], { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);

        data = parser.parse(['+id'], { schema });
        expect(interpreter.interpret(data)).toEqual(['name', 'id']);

        data = parser.parse([], { schema });
        expect(interpreter.interpret(data)).toEqual(['name']);
    });

    it('should use default fields if default & allowed (multiple domains)', async () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                allowed: ['id', 'name'],
                default: ['id'],
            },
            name: 'domain',
        });

        // if multiple possibilities are available for request field, use default
        const data = parser.parse(['id'], { schema });
        expect(interpreter.interpret(data)).toEqual([
            'id',
        ]);
    });

    it('should parse with defaults', async () => {
        const schema = defineSchema({
            fields: { default: ['id', 'name'] },
        });
        let data = parser.parse([], { schema });
        expect(interpreter.interpret(data)).toEqual(['id', 'name']);

        data = parser.parse(['id'], { schema });
        expect(interpreter.interpret(data)).toEqual(['id']);

        data = parser.parse(['fake'], { schema });
        expect(interpreter.interpret(data)).toEqual(['id', 'name']);
    });

    it('should parse fields with aliasMapping', async () => {
        const schema = defineSchema({
            fields: {
                allowed: ['id', 'name'],
                mapping: {
                    alias: 'id',
                },
            },
        });

        let data = parser.parse('+foo', { schema });
        expect(interpreter.interpret(data)).toEqual([
            'id',
            'name',
        ]);

        data = parser.parse('+alias', { schema });
        expect(interpreter.interpret(data)).toEqual([
            'id',
        ]);
    });

    it('should parse with valid relation', async () => {
        // simple domain match
        const data = parser.parse({
            items: ['id'],
            'items.realm': ['id'],
        }, {
            schema: 'user',
            relations: new Relations([
                new Relation('items'),
                new Relation('items.realm'),
            ]),
        });
        expect(interpreter.interpret(data)).toEqual([
            'id',
            'name',
            'email',
            'age',
            'items.id',
            'items.realm.id',
        ]);
    });

    it('should parse with valid & invalid relation', async () => {
        // only single domain match
        const data = parser.parse({
            realm: ['id'],
            permissions: ['id'],
        }, {
            schema: 'user',
            relations: new Relations([
                new Relation('realm'),
            ]),
        });
        expect(interpreter.interpret(data)).toEqual([
            'id',
            'name',
            'email',
            'age',
            'realm.id',
        ]);
    });

    it('should throw on invalid input shape', async () => {
        const error = FieldsParseError.inputInvalid();
        expect(() => parser.parse(false, {
            schema: defineSchema({
                throwOnFailure: true,
            }),
        })).toThrow(error);
    });

    it('should throw on non allowed relation', async () => {
        const schema = defineFieldsSchema({
            throwOnFailure: true,
            allowed: ['user.foo'],
        });

        const error = FieldsParseError.keyPathInvalid('bar');

        expect(() => parser.parse({
            bar: ['bar'],
        }, {
            schema,
            relations: new Relations([
                new Relation('user'),
            ]),
        })).toThrow(error);
    });

    it('should throw on invalid key (pattern)', async () => {
        const schema = defineSchema({
            name: 'user',
            throwOnFailure: true,
            fields: {
                allowed: ['id', 'name', 'email'],
            },
        });

        expect(() => parser.parse(['baz'], { schema })).toThrow(FieldsParseError);
    });

    it('should throw on invalid key (pattern)', async () => {
        const schema = defineSchema({
            throwOnFailure: true,
        });

        expect(() => parser.parse(['!.bar'], { schema })).toThrow(FieldsParseError);
    });
});
