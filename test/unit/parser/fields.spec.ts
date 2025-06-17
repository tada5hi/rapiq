/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type {
    FieldsParseOutput,
    ObjectLiteral,
} from '../../../src';
import {
    FieldsParseError,
    FieldsParser,
    defineFieldsSchema,
    defineSchema,
} from '../../../src';
import { registry } from '../../data/schema';

describe('src/fields/index.ts', () => {
    let parser : FieldsParser;

    beforeAll(() => {
        parser = new FieldsParser(registry);
    });

    it('should parse fields with name', () => {
        const schema = defineSchema({
            name: 'user',
            fields: {
                allowed: ['id', 'name', 'email'],
            },
        });

        const data = parser.parse([], {
            schema,
        });

        expect(data).toEqual([
            'id',
            'name',
            'email',
        ] satisfies FieldsParseOutput);
    });

    it('should parse fields with extra field', () => {
        const schema = defineFieldsSchema({
            allowed: ['id', 'name', 'email'],
            name: 'user',
        });
        const data = parser.parse('+email', {
            schema,
        });
        expect(data).toEqual(['email'] satisfies FieldsParseOutput);
    });

    it('should parse with invalid input (with default)', () => {
        const schema = defineSchema({
            fields: { default: ['id'] },
        });
        const data = parser.parse('name', {
            schema,
        });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);
    });

    it('should parse invalid input (with allowed)', () => {
        const schema = defineSchema({
            fields: {
                allowed: ['id', 'name'],
            },
        });

        // fields undefined
        const data = parser.parse(undefined, { schema });
        expect(data).toEqual(['id', 'name'] satisfies FieldsParseOutput);
    });

    it('should parse with no schema', () => {
        // no options
        let data = parser.parse(['id']);
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // invalid field names
        data = parser.parse(['"id', 'name!']);
        expect(data).toEqual([] satisfies FieldsParseOutput);
    });

    it('should parse with invalid field pattern, if permitted by allowed', () => {
        const schema = defineSchema({
            fields: {
                allowed: ['name!'],
            },
        });

        const data = parser.parse(['name!'], { schema });
        expect(data).toEqual(['name!'] satisfies FieldsParseOutput);
    });

    it('should not parse with empty allowed', () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                allowed: [],
            },
        });

        let data = parser.parse(['id'], { schema });
        expect(data).toEqual([] satisfies FieldsParseOutput);

        data = parser.parse('id', { schema });
        expect(data).toEqual([] satisfies FieldsParseOutput);
    });

    it('should not parse with empty default', () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                default: [],
            },
        });

        const data = parser.parse(['id'], { schema });
        expect(data).toEqual([] satisfies FieldsParseOutput);
    });

    it('should parse invalid input (with allowed & default)', () => {
        const schema = defineFieldsSchema({
            allowed: ['id', 'name'],
            default: ['id'],
        });

        // fields undefined with default
        let data = parser.parse(undefined, { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // fields as array
        data = parser.parse(['id'], { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // fields as string
        data = parser.parse('id', { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // multiple fields but only one valid field
        data = parser.parse(['id', 'avatar'], { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // field as string and append fields
        data = parser.parse('+id', { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        data = parser.parse('avatar,+id', { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        data = parser.parse('-id', { schema });
        expect(data).toEqual([] satisfies FieldsParseOutput);

        // fields as string and append fields
        data = parser.parse('id,+name', { schema });
        expect(data).toEqual(['id', 'name'] satisfies FieldsParseOutput);

        // field not allowed
        data = parser.parse('avatar', { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // field with invalid value
        data = parser.parse({ id: null }, { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);
    });

    it('should parse with single allowed domain', () => {
        const schema = defineSchema({
            name: 'domain',
            fields: {
                allowed: { domain: ['id'] },
            },
        });

        // if only one domain is given, try to parse request field to single domain.
        const data = parser.parse(['id'], { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);
    });

    it('should parse with multiple allowed domains', () => {
        const schema = defineSchema({
            name: 'domain',
            fields: {
                allowed: {
                    domain: ['id', 'name'],
                    domain2: ['id', 'name'],
                },
            },
        });

        // if multiple possibilities are available for request field, use allowed
        const data = parser.parse(['id'], { schema });
        expect(data).toEqual([
            'id',
        ] satisfies FieldsParseOutput);
    });

    it('should use default fields if default & allowed', () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                default: ['name'],
                allowed: ['id'],
            },
        });

        let data = parser.parse(['id'], { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        data = parser.parse(['+id'], { schema });
        expect(data).toEqual(['name', 'id'] satisfies FieldsParseOutput);

        data = parser.parse([], { schema });
        expect(data).toEqual(['name'] satisfies FieldsParseOutput);
    });

    it('should use default fields if default & allowed (multiple domains)', () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                allowed: {
                    domain: ['id', 'name'],
                    domain2: ['id', 'name'],
                },
                default: {
                    domain: ['id'],
                    domain2: ['name'],
                },
            },
            name: 'domain',
        });

        // if multiple possibilities are available for request field, use default
        const data = parser.parse(['id'], { schema });
        expect(data).toEqual([
            'id',
        ] satisfies FieldsParseOutput);
    });

    it('should parse with defaults', () => {
        const schema = defineSchema({
            fields: { default: ['id', 'name'] },
        });
        let data = parser.parse([], { schema });
        expect(data).toEqual(['id', 'name'] satisfies FieldsParseOutput);

        data = parser.parse(['id'], { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        data = parser.parse(['fake'], { schema });
        expect(data).toEqual(['id', 'name'] satisfies FieldsParseOutput);
    });

    it('should parse fields with aliasMapping', () => {
        const schema = defineSchema({
            fields: {
                allowed: ['id', 'name'],
                mapping: {
                    alias: 'id',
                },
            },
        });

        let data = parser.parse('+foo', { schema });
        expect(data).toEqual([
            'id',
            'name',
        ] satisfies FieldsParseOutput);

        data = parser.parse('+alias', { schema });
        expect(data).toEqual([
            'id',
        ] satisfies FieldsParseOutput);
    });

    it('should parse with valid relation', () => {
        // simple domain match
        const data = parser.parse({
            items: ['id'],
            'items.realm': ['id'],
        }, {
            schema: 'user',
            relations: ['items', 'items.realm'],
        });
        expect(data).toEqual([
            'id',
            'name',
            'email',
            'age',
            'items.id',
            'items.realm.id',
        ] satisfies FieldsParseOutput);
    });

    it('should parse with valid & invalid relation', () => {
        // only single domain match
        const data = parser.parse({
            realm: ['id'],
            permissions: ['id'],
        }, { schema: 'user', relations: ['realm'] });
        expect(data).toEqual([
            'id',
            'name',
            'email',
            'age',
            'realm.id',
        ] satisfies FieldsParseOutput);
    });

    it('should throw on invalid input shape', () => {
        const error = FieldsParseError.inputInvalid();
        const evaluate = () => {
            parser.parse(false, {
                schema: defineSchema({
                    throwOnFailure: true,
                }),
            });
        };
        expect(evaluate).toThrow(error);
    });

    it('should throw on non allowed relation', () => {
        const schema = defineFieldsSchema({
            throwOnFailure: true,
            allowed: ['user.foo'],
        });

        const error = FieldsParseError.keyPathInvalid('bar');
        const evaluate = () => {
            parser.parse({
                bar: ['bar'],
            }, {
                schema,
                relations: ['user'],
            });
        };
        expect(evaluate).toThrow(error);
    });

    it('should throw on invalid key (pattern)', () => {
        const schema = defineSchema({
            name: 'user',
            throwOnFailure: true,
            fields: {
                allowed: ['id', 'name', 'email'],
            },
        });

        const t = () => parser.parse(['baz'], { schema });

        expect(t).toThrow(FieldsParseError);
    });

    it('should throw on invalid key (pattern)', () => {
        const schema = defineSchema({
            throwOnFailure: true,
        });

        const t = () => parser.parse(['!.bar'], { schema });

        expect(t).toThrow(FieldsParseError);
    });
});
