/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { SortParseOutput } from '../../../src';
import {
    RelationsParser,
    SortDirection,
    SortParseError,
    SortParser,

    defineRelationsSchema,
    defineSortSchema,
} from '../../../src';
import type { User } from '../../data';

describe('src/sort/index.ts', () => {
    let parser : SortParser;

    beforeAll(() => {
        parser = new SortParser();
    });

    it('should parse sort data', () => {
        // sort asc
        let transformed = parser.parse('id', {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.ASC }] satisfies SortParseOutput);

        // sort desc
        transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] satisfies SortParseOutput);

        // invalid field names
        transformed = parser.parse('-!id');
        expect(transformed).toEqual([] satisfies SortParseOutput);

        // ignore field name pattern, if permitted by allowed key
        transformed = parser.parse(['-!id'], {
            schema: defineSortSchema({
                allowed: ['!id'],
            }),
        });
        expect(transformed).toEqual([{ key: '!id', value: SortDirection.DESC }] satisfies SortParseOutput);

        // empty allowed
        transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: [],
            }),
        });
        expect(transformed).toEqual([] satisfies SortParseOutput);

        // undefined allowed
        transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: undefined,
            }),
        });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] satisfies SortParseOutput);

        // only default
        transformed = parser.parse('name', {
            schema: defineSortSchema({
                default: { name: 'DESC' },
            }),
        });
        expect(transformed).toEqual([{ key: 'name', value: SortDirection.ASC }] satisfies SortParseOutput);

        // only default with no match
        transformed = parser.parse('-id', {
            schema: defineSortSchema({
                default: { name: 'DESC' },
            }),
        });
        expect(transformed).toEqual([{ key: 'name', value: SortDirection.DESC }] satisfies SortParseOutput);

        // wrong allowed
        transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: ['a'],
            }),
        });
        expect(transformed).toEqual([] satisfies SortParseOutput);

        // array data
        transformed = parser.parse(['-id'], {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] satisfies SortParseOutput);

        // object data
        transformed = parser.parse({ id: 'ASC' }, {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.ASC }] satisfies SortParseOutput);

        // wrong input data data
        transformed = parser.parse({ id: 'Right' }, {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.ASC }] satisfies SortParseOutput);

        // with query alias
        transformed = parser.parse('-id', {
            schema: defineSortSchema({
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] satisfies SortParseOutput);

        // with mapping
        transformed = parser.parse('-pit', {
            schema: defineSortSchema({
                mapping: { pit: 'id' },
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] satisfies SortParseOutput);

        // with mapping & query alias
        transformed = parser.parse('-pit', {
            schema: defineSortSchema({
                mapping: { pit: 'id' },
                allowed: ['id'],
            }),
        });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] satisfies SortParseOutput);
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
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.ASC }] satisfies SortParseOutput);

        transformed = parser.parse(undefined, { schema });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] satisfies SortParseOutput);

        transformed = parser.parse([], { schema });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] satisfies SortParseOutput);

        transformed = parser.parse('-age', { schema });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] satisfies SortParseOutput);
    });

    it('should parse sort with sort indexes', () => {
        const schema = defineSortSchema<User>({
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
        });

        // simple
        let transformed = parser.parse(['id'], { schema });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.ASC }] satisfies SortParseOutput);

        // correct order
        transformed = parser.parse(['name', 'email'], { schema });
        expect(transformed).toStrictEqual([
            { key: 'name', value: SortDirection.ASC },
            { key: 'email', value: SortDirection.ASC },
        ] satisfies SortParseOutput);

        // incorrect order
        transformed = parser.parse(['email', 'name'], { schema });
        expect(transformed).toStrictEqual([
            { key: 'name', value: SortDirection.ASC },
            { key: 'email', value: SortDirection.ASC },
        ] satisfies SortParseOutput);

        // no match
        transformed = parser.parse(['email'], { schema });
        expect(transformed).toStrictEqual([]);
    });

    it('should parse sort with sort indexes & default path', () => {
        const schema = defineSortSchema<User>({
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
            defaultPath: 'user',
        });

        // incomplete match
        const transformed = parser.parse(['email', 'id'], { schema });
        expect(transformed).toStrictEqual([
            { key: 'id', path: 'user', value: SortDirection.ASC },
        ] satisfies SortParseOutput);
    });

    it('should transform sort data with includes', () => {
        const relationsParser = new RelationsParser();
        const includes = relationsParser.parse(
            ['profile', 'user_roles.role'],
            {
                schema: defineRelationsSchema({
                    allowed: ['profile', 'user_roles.role'],
                }),
            },
        );

        const schema = defineSortSchema({
            allowed: ['id', 'profile.id', 'user_roles.role.id'],
        });

        // simple
        let transformed = parser.parse(['id'], {
            schema,
            relations: includes,
        });
        expect(transformed).toEqual([
            { key: 'id', value: SortDirection.ASC },
        ] satisfies SortParseOutput);

        // with query alias
        transformed = parser.parse(['id'], {
            schema,
            relations: includes,
        });
        expect(transformed).toEqual([
            { key: 'id', value: SortDirection.ASC },
        ] satisfies SortParseOutput);

        // with include
        transformed = parser.parse(['id', 'profile.id'], {
            schema,
            relations: includes,
        });
        expect(transformed).toEqual([
            { key: 'id', value: SortDirection.ASC },
            { path: 'profile', key: 'id', value: SortDirection.ASC },
        ] satisfies SortParseOutput);

        // with include & query alias
        transformed = parser.parse(['id', 'profile.id'], {
            schema,
            relations: includes,
        });
        expect(transformed).toEqual([
            { key: 'id', value: SortDirection.ASC },
            { path: 'profile', key: 'id', value: SortDirection.ASC },
        ] satisfies SortParseOutput);

        // with deep nested include
        transformed = parser.parse(['id', 'user_roles.role.id', 'user_roles.user.id'], {
            schema,
            relations: includes,
        });
        expect(transformed).toEqual([
            { key: 'id', value: SortDirection.ASC },
            { path: 'user_roles.role', key: 'id', value: SortDirection.ASC },
        ] satisfies SortParseOutput);
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
        const schema = defineSortSchema({
            throwOnFailure: true,
            allowed: ['user.foo'],
        });
        const evaluate = () => {
            parser.parse({
                'bar.bar': 'desc',
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

        const error = SortParseError.keyPathInvalid('bar');
        expect(evaluate).toThrow(error);
    });

    it('should throw on non allowed key which is not covered by a relation', () => {
        const schema = defineSortSchema({
            throwOnFailure: true,
            allowed: ['user.foo'],
        });

        const evaluate = () => {
            parser.parse({
                'user.bar': 'desc',
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

        const error = SortParseError.keyNotAllowed('bar');
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

        const error = SortParseError.keyValueInvalid('bar');
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

        const error = SortParseError.keyNotAllowed('bar');
        expect(evaluate).toThrow(error);
    });
});
