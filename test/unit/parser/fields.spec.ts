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
    RelationsParser,
    defineFieldsSchema,
    defineSchema,
} from '../../../src';

describe('src/fields/index.ts', () => {
    let parser : FieldsParser;

    beforeAll(() => {
        parser = new FieldsParser();
    });

    it('should parse fields with defaultPath', () => {
        const schema = defineSchema({
            fields: {
                allowed: ['id', 'name', 'email'],
                defaultPath: 'user',
            },
        });

        const data = parser.parse([], {
            schema,
        });

        expect(data).toEqual([
            {
                key: 'id',
                path: 'user',
            },
            {
                key: 'name',
                path: 'user',
            },
            {
                key: 'email',
                path: 'user',
            },
        ] as FieldsParseOutput);
    });

    it('should parse fields with extra field', () => {
        const schema = defineFieldsSchema({
            allowed: ['id', 'name', 'email'],
            defaultPath: 'user',
        });
        const data = parser.parse('+email', {
            schema,
        });
        expect(data).toEqual([
            {
                key: 'email',
                path: 'user',
            },
        ] as FieldsParseOutput);
    });

    it('should parse with different allowed values', () => {
        const schema = defineFieldsSchema<{
            id: string,
            name: string,
            email: string,
            domain: {
                extra: string
            }
        }>({
            allowed: [
                ['id', 'name', 'email'],
                {
                    domain: ['extra'],
                },
            ],
            defaultPath: 'user',
        });

        let data = parser.parse('+email', {
            schema,
        });
        expect(data).toEqual([
            {
                key: 'email',
                path: 'user',
            },
            {
                key: 'extra',
                path: 'domain',
            },
        ] as FieldsParseOutput);

        data = parser.parse('+extra', {
            schema,
        });
        expect(data).toEqual([
            {
                key: 'id',
                path: 'user',
            },
            {
                key: 'name',
                path: 'user',
            },
            {
                key: 'email',
                path: 'user',
            },
            {
                key: 'extra',
                path: 'domain',
            },
        ]);

        data = parser.parse({
            domain: '+extra',
        }, {
            schema,
        });
        expect(data).toEqual([
            {
                key: 'id',
                path: 'user',
            },
            {
                key: 'name',
                path: 'user',
            },
            {
                key: 'email',
                path: 'user',
            },
            {
                key: 'extra',
                path: 'domain',
            },
        ] as FieldsParseOutput);
    });

    it('should parse with invalid input (with default)', () => {
        const schema = defineSchema({
            fields: { default: ['id'] },
        });
        const data = parser.parse('name', {
            schema,
        });
        expect(data).toEqual([{ key: 'id' }]);
    });

    it('should parse invalid input (with allowed)', () => {
        const schema = defineSchema({
            fields: {
                allowed: ['id', 'name'],
            },
        });

        // fields undefined
        const data = parser.parse(undefined, { schema });
        expect(data).toEqual([{ key: 'id' }, { key: 'name' }]);
    });

    it('should parse with no schema', () => {
        // no options
        let data = parser.parse(['id']);
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        // invalid field names
        data = parser.parse(['"id', 'name!']);
        expect(data).toEqual([] as FieldsParseOutput);
    });

    it('should parse with invalid field pattern, if permitted by allowed', () => {
        const schema = defineSchema({
            fields: {
                allowed: ['name!'],
            },
        });

        const data = parser.parse(['name!'], { schema });
        expect(data).toEqual([{ key: 'name!' }] as FieldsParseOutput);
    });

    it('should not parse with empty allowed', () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                allowed: [],
            },
        });

        let data = parser.parse(['id'], { schema });
        expect(data).toEqual([] as FieldsParseOutput);

        data = parser.parse('id', { schema });
        expect(data).toEqual([] as FieldsParseOutput);
    });

    it('should not parse with empty default', () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                default: [],
            },
        });

        const data = parser.parse(['id'], { schema });
        expect(data).toEqual([] as FieldsParseOutput);
    });

    it('should parse invalid input (with allowed & default)', () => {
        const schema = defineFieldsSchema({
            allowed: ['id', 'name'],
            default: ['id'],
        });

        // fields undefined with default
        let data = parser.parse(undefined, { schema });
        expect(data).toEqual([{ key: 'id' }]);

        // fields as array
        data = parser.parse(['id'], { schema });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        // fields as string
        data = parser.parse('id', { schema });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        // multiple fields but only one valid field
        data = parser.parse(['id', 'avatar'], { schema });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        // field as string and append fields
        data = parser.parse('+id', { schema });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        data = parser.parse('avatar,+id', { schema });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        data = parser.parse('-id', { schema });
        expect(data).toEqual([] as FieldsParseOutput);

        // fields as string and append fields
        data = parser.parse('id,+name', { schema });
        expect(data).toEqual([{ key: 'id' }, { key: 'name' }] as FieldsParseOutput);

        // field not allowed
        data = parser.parse('avatar', { schema });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        // field with invalid value
        data = parser.parse({ id: null }, { schema });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);
    });

    it('should parse with single allowed domain', () => {
        const schema = defineSchema({
            fields: {
                allowed: { domain: ['id'] },
            },
        });

        // if only one domain is given, try to parse request field to single domain.
        const data = parser.parse(['id'], { schema });
        expect(data).toEqual([{ path: 'domain', key: 'id' }] as FieldsParseOutput);
    });

    it('should parse with multiple allowed domains', () => {
        const schema = defineSchema({
            fields: {
                allowed: {
                    domain: ['id', 'name'],
                    domain2: ['id', 'name'],
                },
            },
            defaultPath: 'domain',
        });

        // if multiple possibilities are available for request field, use allowed
        const data = parser.parse(['id'], { schema });
        expect(data).toEqual([
            { path: 'domain', key: 'id' },
            { path: 'domain2', key: 'id' },
            { path: 'domain2', key: 'name' },
        ] as FieldsParseOutput);
    });

    it('should use default fields if default & allowed', () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                default: ['name'],
                allowed: ['id'],
            },
        });

        let data = parser.parse(['id'], { schema });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        data = parser.parse(['+id'], { schema });
        expect(data).toEqual([{ key: 'name' }, { key: 'id' }] as FieldsParseOutput);

        data = parser.parse([], { schema });
        expect(data).toEqual([{ key: 'name' }] as FieldsParseOutput);
    });

    it('should use default fields if default & allowed (multiple domains)', () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                allowed: { domain: ['id', 'name'], domain2: ['id', 'name'] },
                default: { domain: ['id'], domain2: ['name'] },
            },
        });

        // if multiple possibilities are available for request field, use default
        const data = parser.parse(['id'], { schema });
        expect(data).toEqual([
            { path: 'domain', key: 'id' },
            { path: 'domain2', key: 'name' },
        ] as FieldsParseOutput);
    });

    it('should parse with defaults', () => {
        const schema = defineSchema({
            fields: { default: ['id', 'name'] },
        });
        let data = parser.parse([], { schema });
        expect(data).toEqual([{ key: 'id' }, { key: 'name' }] as FieldsParseOutput);

        data = parser.parse(['id'], { schema });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        data = parser.parse(['fake'], { schema });
        expect(data).toEqual([{ key: 'id' }, { key: 'name' }] as FieldsParseOutput);
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
            { key: 'id' },
            { key: 'name' },
        ] as FieldsParseOutput);

        data = parser.parse('+alias', { schema });
        expect(data).toEqual([
            { key: 'id' },
        ] as FieldsParseOutput);
    });

    it('should parse with includes', () => {
        const schema = defineSchema<ObjectLiteral>({
            fields: {
                allowed: {
                    profile: ['id'],
                    permissions: ['id'],
                },
            },
            relations: {
                allowed: ['user', 'profile'],
            },
        });

        const relationsParser = new RelationsParser();
        const relations = relationsParser.parse(['profile', 'roles'], { schema });

        // simple domain match
        let data = parser.parse({ profile: ['id'] }, { schema, relations });
        expect(data).toEqual([{ path: 'profile', key: 'id' }] as FieldsParseOutput);

        // only single domain match
        data = parser.parse({ profile: ['id'], permissions: ['id'] }, { schema, relations });
        expect(data).toEqual([{ path: 'profile', key: 'id' }] as FieldsParseOutput);
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
                relations: [
                    {
                        key: 'user',
                        value: 'user',
                    },
                ],
            });
        };
        expect(evaluate).toThrow(error);
    });

    it('should throw on invalid key (pattern)', () => {
        const schema = defineSchema({
            throwOnFailure: true,
            fields: {
                allowed: ['id', 'name', 'email'],
                defaultPath: 'user',
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
