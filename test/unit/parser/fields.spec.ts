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

    it('should parse fields with name', async () => {
        const schema = defineSchema({
            name: 'user',
            fields: {
                allowed: ['id', 'name', 'email'],
            },
        });

        const data = await parser.parse([], {
            schema,
        });

        expect(data).toEqual([
            'id',
            'name',
            'email',
        ] satisfies FieldsParseOutput);
    });

    it('should parse fields with extra field', async () => {
        const schema = defineFieldsSchema({
            allowed: ['id', 'name', 'email'],
            name: 'user',
        });
        const data = await parser.parse('+email', {
            schema,
        });
        expect(data).toEqual(['email'] satisfies FieldsParseOutput);
    });

    it('should parse with invalid input (with default)', async () => {
        const schema = defineSchema({
            fields: { default: ['id'] },
        });
        const data = await parser.parse('name', {
            schema,
        });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);
    });

    it('should parse invalid input (with allowed)', async () => {
        const schema = defineSchema({
            fields: {
                allowed: ['id', 'name'],
            },
        });

        // fields undefined
        const data = await parser.parse(undefined, { schema });
        expect(data).toEqual(['id', 'name'] satisfies FieldsParseOutput);
    });

    it('should parse with no schema', async () => {
        // no options
        let data = await parser.parse(['id']);
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // invalid field names
        data = await parser.parse(['"id', 'name!']);
        expect(data).toEqual([] satisfies FieldsParseOutput);
    });

    it('should parse with invalid field pattern, if permitted by allowed', async () => {
        const schema = defineSchema({
            fields: {
                allowed: ['name!'],
            },
        });

        const data = await parser.parse(['name!'], { schema });
        expect(data).toEqual(['name!'] satisfies FieldsParseOutput);
    });

    it('should not parse with empty allowed', async () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                allowed: [],
            },
        });

        let data = await parser.parse(['id'], { schema });
        expect(data).toEqual([] satisfies FieldsParseOutput);

        data = await parser.parse('id', { schema });
        expect(data).toEqual([] satisfies FieldsParseOutput);
    });

    it('should not parse with empty default', async () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                default: [],
            },
        });

        const data = await parser.parse(['id'], { schema });
        expect(data).toEqual([] satisfies FieldsParseOutput);
    });

    it('should parse invalid input (with allowed & default)', async () => {
        const schema = defineFieldsSchema({
            allowed: ['id', 'name'],
            default: ['id'],
        });

        // fields undefined with default
        let data = await parser.parse(undefined, { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // fields as array
        data = await parser.parse(['id'], { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // fields as string
        data = await parser.parse('id', { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // multiple fields but only one valid field
        data = await parser.parse(['id', 'avatar'], { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // field as string and append fields
        data = await parser.parse('+id', { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        data = await parser.parse('avatar,+id', { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        data = await parser.parse('-id', { schema });
        expect(data).toEqual([] satisfies FieldsParseOutput);

        // fields as string and append fields
        data = await parser.parse('id,+name', { schema });
        expect(data).toEqual(['id', 'name'] satisfies FieldsParseOutput);

        // field not allowed
        data = await parser.parse('avatar', { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        // field with invalid value
        data = await parser.parse({ id: null }, { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);
    });

    it('should parse with single allowed domain', async () => {
        const schema = defineSchema({
            name: 'domain',
            fields: {
                allowed: ['id'],
            },
        });

        // if only one domain is given, try to parse request field to single domain.
        const data = await parser.parse(['id'], { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);
    });

    it('should parse with multiple allowed domains', async () => {
        const schema = defineSchema({
            name: 'domain',
            fields: {
                allowed: ['id', 'name'],
            },
        });

        // if multiple possibilities are available for request field, use allowed
        const data = await parser.parse(['id'], { schema });
        expect(data).toEqual([
            'id',
        ] satisfies FieldsParseOutput);
    });

    it('should use default fields if default & allowed', async () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                default: ['name'],
                allowed: ['id'],
            },
        });

        let data = await parser.parse(['id'], { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        data = await parser.parse(['+id'], { schema });
        expect(data).toEqual(['name', 'id'] satisfies FieldsParseOutput);

        data = await parser.parse([], { schema });
        expect(data).toEqual(['name'] satisfies FieldsParseOutput);
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
        const data = await parser.parse(['id'], { schema });
        expect(data).toEqual([
            'id',
        ] satisfies FieldsParseOutput);
    });

    it('should parse with defaults', async () => {
        const schema = defineSchema({
            fields: { default: ['id', 'name'] },
        });
        let data = await parser.parse([], { schema });
        expect(data).toEqual(['id', 'name'] satisfies FieldsParseOutput);

        data = await parser.parse(['id'], { schema });
        expect(data).toEqual(['id'] satisfies FieldsParseOutput);

        data = await parser.parse(['fake'], { schema });
        expect(data).toEqual(['id', 'name'] satisfies FieldsParseOutput);
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

        let data = await parser.parse('+foo', { schema });
        expect(data).toEqual([
            'id',
            'name',
        ] satisfies FieldsParseOutput);

        data = await parser.parse('+alias', { schema });
        expect(data).toEqual([
            'id',
        ] satisfies FieldsParseOutput);
    });

    it('should parse with valid relation', async () => {
        // simple domain match
        const data = await parser.parse({
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

    it('should parse with valid & invalid relation', async () => {
        // only single domain match
        const data = await parser.parse({
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

    it('should throw on invalid input shape', async () => {
        const error = FieldsParseError.inputInvalid();
        await expect(parser.parse(false, {
            schema: defineSchema({
                throwOnFailure: true,
            }),
        })).rejects.toThrow(error);
    });

    it('should throw on non allowed relation', async () => {
        const schema = defineFieldsSchema({
            throwOnFailure: true,
            allowed: ['user.foo'],
        });

        const error = FieldsParseError.keyPathInvalid('bar');

        await expect(parser.parse({
            bar: ['bar'],
        }, {
            schema,
            relations: ['user'],
        })).rejects.toThrow(error);
    });

    it('should throw on invalid key (pattern)', async () => {
        const schema = defineSchema({
            name: 'user',
            throwOnFailure: true,
            fields: {
                allowed: ['id', 'name', 'email'],
            },
        });

        await expect(parser.parse(['baz'], { schema })).rejects.toThrow(FieldsParseError);
    });

    it('should throw on invalid key (pattern)', async () => {
        const schema = defineSchema({
            throwOnFailure: true,
        });

        await expect(parser.parse(['!.bar'], { schema })).rejects.toThrow(FieldsParseError);
    });
});
