/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { SortParseOutput } from '../../../src';
import {
    SortDirection,
    SortParseError,
    SortParser,
    defineSortSchema,
} from '../../../src';
import type { User } from '../../data';
import { registry } from '../../data/schema';

describe('src/sort/index.ts', () => {
    let parser : SortParser;

    beforeAll(() => {
        parser = new SortParser(registry);
    });

    it('should parse sort data', async () => {
        // sort asc
        const transformed = await parser.parse('id', {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.ASC } satisfies SortParseOutput);
    });

    it('should parse with desc prefix (-)', async () => {
        // sort desc
        const transformed = await parser.parse('-id', {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should not parse with invalid field name', async () => {
        // invalid field names
        const transformed = await parser.parse('-!id');
        expect(transformed).toEqual({} satisfies SortParseOutput);
    });

    it('should ignore invalid field name', async () => {
        // ignore field name pattern, if permitted by allowed key
        const transformed = await parser.parse(['-!id'], {
            schema: defineSortSchema({
                allowed: ['!id'],
            }),
        });
        expect(transformed).toEqual({ '!id': SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should parse with empty allowed', async () => {
        // empty allowed
        const transformed = await parser.parse('-id', {
            schema: defineSortSchema({
                allowed: [],
            }),
        });
        expect(transformed).toEqual({} satisfies SortParseOutput);
    });

    it('should parse with undefined allowed', async () => {
        // undefined allowed
        const transformed = await parser.parse('-id', {
            schema: defineSortSchema({
                allowed: undefined,
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should parse with only default', async () => {
        // only default
        const transformed = await parser.parse('name', {
            schema: defineSortSchema({
                default: { name: 'DESC' },
            }),
        });
        expect(transformed).toEqual({ name: SortDirection.ASC }satisfies SortParseOutput);
    });

    it('should parse with only default and desc', async () => {
        // only default with no match
        const transformed = await parser.parse('-id', {
            schema: defineSortSchema({
                default: { name: 'DESC' },
            }),
        });
        expect(transformed).toEqual({ name: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should not parse with wrong allowed', async () => {
        // wrong allowed
        const transformed = await parser.parse('-id', {
            schema: defineSortSchema({
                allowed: ['a'],
            }),
        });
        expect(transformed).toEqual({} satisfies SortParseOutput);
    });

    it('should parse array input', async () => {
        // array data
        const transformed = await parser.parse(['-id'], {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should parse object input', async () => {
        // object data
        const transformed = await parser.parse({ id: 'ASC' }, {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.ASC } satisfies SortParseOutput);
    });

    it('should not parse invalid input data', async () => {
        // wrong input data data
        const transformed = await parser.parse({ id: 'Right' }, {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual({} satisfies SortParseOutput);
    });

    it('should parse with field alias', async () => {
        // with query alias
        const transformed = await parser.parse('-alias', {
            schema: defineSortSchema({
                allowed: ['id'],
                mapping: {
                    alias: 'id',
                },
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);
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

        let transformed = await parser.parse(['id'], { schema });
        expect(transformed).toEqual({ id: SortDirection.ASC } satisfies SortParseOutput);

        transformed = await parser.parse(undefined, { schema });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);

        transformed = await parser.parse([], { schema });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);

        transformed = await parser.parse('-age', { schema });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should parse sort with sort indexes (simple)', async () => {
        const schema = defineSortSchema<User>({
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
        });

        // simple
        const transformed = await parser.parse(['id'], { schema });
        expect(transformed).toEqual({ id: SortDirection.ASC } satisfies SortParseOutput);
    });

    it('should parse sort with sort indexes (tuple)', async () => {
        const schema = defineSortSchema<User>({
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
        });

        // correct order
        let transformed = await parser.parse(['name', 'email'], { schema });
        expect(transformed).toStrictEqual({
            name: SortDirection.ASC,
            email: SortDirection.ASC,
        } satisfies SortParseOutput);

        // incorrect order
        transformed = await parser.parse(['email', 'name'], { schema });
        expect(transformed).toStrictEqual({
            name: SortDirection.ASC,
            email: SortDirection.ASC,
        } satisfies SortParseOutput);

        // no match
        transformed = await parser.parse(['email'], { schema });
        expect(transformed).toStrictEqual({} satisfies SortParseOutput);
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
        const transformed = await parser.parse(['email', 'id'], { schema });
        expect(transformed).toStrictEqual({
            id: SortDirection.ASC,
        } satisfies SortParseOutput);
    });

    it('should parse with simple relation', async () => {
        const transformed = await parser.parse(['id', 'realm.id'], {
            schema: 'user',
            relations: ['realm'],
        });
        expect(transformed).toEqual({
            id: SortDirection.ASC,
            'realm.id': SortDirection.ASC,
        } satisfies SortParseOutput);
    });

    it('should parse with nested relation', async () => {
        // with deep nested include
        const transformed = await parser.parse(['id', 'items.realm.id'], {
            schema: 'user',
            relations: ['items', 'items.realm'],
            throwOnFailure: true,
        });
        expect(transformed).toEqual({
            id: SortDirection.ASC,
            'items.realm.id': SortDirection.ASC,
        }satisfies SortParseOutput);
    });

    it('should throw on invalid input', async () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
        });

        const error = SortParseError.inputInvalid();

        await expect(parser.parse(false, { schema })).rejects.toThrow(error);
    });

    it('should throw on invalid key', async () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
        });

        const error = SortParseError.keyInvalid('1foo');
        await expect(parser.parse({
            '1foo': 'desc',
        }, { schema })).rejects.toThrow(error);
    });

    it('should throw on non allowed relation', async () => {
        const error = SortParseError.keyPathInvalid('bar');

        await expect(parser.parse({
            'bar.bar': 'desc',
        }, {
            schema: 'user',
            relations: ['realm'],
            throwOnFailure: true,
        })).rejects.toThrow(error.message);
    });

    it('should throw on non allowed key which is not covered by a relation', async () => {
        const error = SortParseError.keyNotPermitted('description');

        await expect(parser.parse({
            'realm.description': 'desc',
        }, {
            schema: 'user',
            relations: ['realm'],
            throwOnFailure: true,
        })).rejects.toThrow(error);
    });

    it('should throw on invalid key value', async () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
            allowed: ['foo'],
        });

        const error = SortParseError.inputInvalid();

        await expect(parser.parse({
            bar: 1,
        }, {
            schema,
        })).rejects.toThrow(error);
    });

    it('should throw on non allowed key', async () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
            allowed: ['foo'],
        });

        const error = SortParseError.keyNotPermitted('bar');

        await expect(parser.parse({
            bar: 'desc',
        }, { schema })).rejects.toThrow(error);
    });
});
