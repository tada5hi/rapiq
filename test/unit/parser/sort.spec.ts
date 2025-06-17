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

    it('should parse sort data', () => {
        // sort asc
        const transformed = parser.parse('id', {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.ASC } satisfies SortParseOutput);
    });

    it('should parse with desc prefix (-)', () => {
        // sort desc
        const transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should not parse with invalid field name', () => {
        // invalid field names
        const transformed = parser.parse('-!id');
        expect(transformed).toEqual({} satisfies SortParseOutput);
    });

    it('should ignore invalid field name', () => {
        // ignore field name pattern, if permitted by allowed key
        const transformed = parser.parse(['-!id'], {
            schema: defineSortSchema({
                allowed: ['!id'],
            }),
        });
        expect(transformed).toEqual({ '!id': SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should parse with empty allowed', () => {
        // empty allowed
        const transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: [],
            }),
        });
        expect(transformed).toEqual({} satisfies SortParseOutput);
    });

    it('should parse with undefined allowed', () => {
        // undefined allowed
        const transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: undefined,
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should parse with only default', () => {
        // only default
        const transformed = parser.parse('name', {
            schema: defineSortSchema({
                default: { name: 'DESC' },
            }),
        });
        expect(transformed).toEqual({ name: SortDirection.ASC }satisfies SortParseOutput);
    });

    it('should parse with only default and desc', () => {
        // only default with no match
        const transformed = parser.parse('-id', {
            schema: defineSortSchema({
                default: { name: 'DESC' },
            }),
        });
        expect(transformed).toEqual({ name: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should not parse with wrong allowed', () => {
        // wrong allowed
        const transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: ['a'],
            }),
        });
        expect(transformed).toEqual({} satisfies SortParseOutput);
    });

    it('should parse array input', () => {
        // array data
        const transformed = parser.parse(['-id'], {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should parse object input', () => {
        // object data
        const transformed = parser.parse({ id: 'ASC' }, {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.ASC } satisfies SortParseOutput);
    });

    it('should not parse invalid input data', () => {
        // wrong input data data
        const transformed = parser.parse({ id: 'Right' }, {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual({} satisfies SortParseOutput);
    });

    it('should parse with field alias', () => {
        // with query alias
        const transformed = parser.parse('-alias', {
            schema: defineSortSchema({
                allowed: ['id'],
                mapping: {
                    alias: 'id',
                },
            }),
        });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should transform sort with default', () => {
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
        expect(transformed).toEqual({ id: SortDirection.ASC } satisfies SortParseOutput);

        transformed = parser.parse(undefined, { schema });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);

        transformed = parser.parse([], { schema });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);

        transformed = parser.parse('-age', { schema });
        expect(transformed).toEqual({ id: SortDirection.DESC } satisfies SortParseOutput);
    });

    it('should parse sort with sort indexes (simple)', () => {
        const schema = defineSortSchema<User>({
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
        });

        // simple
        const transformed = parser.parse(['id'], { schema });
        expect(transformed).toEqual({ id: SortDirection.ASC } satisfies SortParseOutput);
    });

    it('should parse sort with sort indexes (tuple)', () => {
        const schema = defineSortSchema<User>({
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
        });

        // correct order
        let transformed = parser.parse(['name', 'email'], { schema });
        expect(transformed).toStrictEqual({
            name: SortDirection.ASC,
            email: SortDirection.ASC,
        } satisfies SortParseOutput);

        // incorrect order
        transformed = parser.parse(['email', 'name'], { schema });
        expect(transformed).toStrictEqual({
            name: SortDirection.ASC,
            email: SortDirection.ASC,
        } satisfies SortParseOutput);

        // no match
        transformed = parser.parse(['email'], { schema });
        expect(transformed).toStrictEqual({} satisfies SortParseOutput);
    });

    it('should parse sort with sort indexes & default path', () => {
        const schema = defineSortSchema<User>({
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
            name: 'user',
        });

        // incomplete match
        const transformed = parser.parse(['email', 'id'], { schema });
        expect(transformed).toStrictEqual({
            id: SortDirection.ASC,
        } satisfies SortParseOutput);
    });

    it('should parse with simple relation', () => {
        const transformed = parser.parse(['id', 'realm.id'], {
            schema: 'user',
            relations: ['realm'],
        });
        expect(transformed).toEqual({
            id: SortDirection.ASC,
            'realm.id': SortDirection.ASC,
        } satisfies SortParseOutput);
    });

    it('should parse with nested relation', () => {
        // with deep nested include
        const transformed = parser.parse(['id', 'items.realm.id'], {
            schema: 'user',
            relations: ['items', 'items.realm'],
            throwOnFailure: true,
        });
        expect(transformed).toEqual({
            id: SortDirection.ASC,
            'items.realm.id': SortDirection.ASC,
        }satisfies SortParseOutput);
    });

    it('should throw on invalid input', () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
        });

        const evaluate = () => {
            parser.parse(false, { schema });
        };

        const error = SortParseError.inputInvalid();
        expect(evaluate).toThrow(error);
    });

    it('should throw on invalid key', () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
        });

        const evaluate = () => {
            parser.parse({
                '1foo': 'desc',
            }, { schema });
        };
        const error = SortParseError.keyInvalid('1foo');
        expect(evaluate).toThrow(error);
    });

    it('should throw on non allowed relation', () => {
        const evaluate = () => {
            parser.parse({
                'bar.bar': 'desc',
            }, {
                schema: 'user',
                relations: ['realm'],
                throwOnFailure: true,
            });
        };

        const error = SortParseError.keyPathInvalid('bar');
        expect(evaluate).toThrow(error);
    });

    it('should throw on non allowed key which is not covered by a relation', () => {
        const evaluate = () => {
            parser.parse({
                'realm.description': 'desc',
            }, {
                schema: 'user',
                relations: ['realm'],
                throwOnFailure: true,
            });
        };

        const error = SortParseError.keyNotPermitted('description');
        expect(evaluate).toThrow(error);
    });

    it('should throw on invalid key value', () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
            allowed: ['foo'],
        });

        const evaluate = () => {
            parser.parse({
                bar: 1,
            }, {
                schema,
            });
        };

        const error = SortParseError.inputInvalid();
        expect(evaluate).toThrow(error);
    });

    it('should throw on non allowed key', () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
            allowed: ['foo'],
        });

        const evaluate = () => {
            parser.parse({
                bar: 'desc',
            }, { schema });
        };

        const error = SortParseError.keyNotPermitted('bar');
        expect(evaluate).toThrow(error);
    });
});
