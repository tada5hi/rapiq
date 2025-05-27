/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { allInterpreters, createSqlInterpreter, pg } from '@ucast/sql';
import type { FiltersParseOptions, ObjectLiteral } from '../../../src';
import {
    FiltersParseError,
    FiltersParser,
    RelationsParser,
    defineFiltersSchema,
    defineRelationsSchema,
} from '../../../src';

const interpreter = createSqlInterpreter(allInterpreters);

describe('src/filter/index.ts', () => {
    let parser : FiltersParser;

    beforeAll(() => {
        parser = new FiltersParser();
    });

    const parsi = <T extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options?: FiltersParseOptions<T>,
    ) => {
        const parsed = parser.parse(input, options);

        return interpreter(parsed, {
            ...pg,
            joinRelation: () => true,
        });
    };

    it('should parse with allowed', () => {
        // filter id
        const [sql, params] = parsi({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id'],
            }),
        });

        expect(sql).toEqual('"id" = $1');
        expect(params).toEqual([1]);
    });

    it('should parse with allowed (underscore key)', () => {
        // filter with underscore key
        const [sql, params] = parsi({ display_name: 'admin' }, {
            schema: defineFiltersSchema({
                allowed: ['display_name'],
            }),
        });

        expect(sql).toEqual('"display_name" = $1');
        expect(params).toEqual(['admin']);
    });

    it('should parse with allowed (empty)', () => {
        // filter none
        const [sql] = parsi({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: [],
            }),
        });
        expect(sql).toEqual('()');
    });

    it('should parse with allowed (undefined)', () => {
        // filter
        const [sql, params] = parsi({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: undefined,
            }),
        });

        expect(sql).toEqual('"id" = $1');
        expect(params).toEqual([1]);
    });

    it('should parse with allowed & mapping', () => {
        // filter with mapping
        const [sql, params] = parsi({ aliasId: 1 }, {
            schema: defineFiltersSchema({
                mapping: { aliasId: 'id' },
                allowed: ['id'],
            }),
        });
        expect(sql).toEqual('"id" = $1');
        expect(params).toEqual([1]);
    });

    it('should not parse with non matching name', () => {
        // filter wrong allowed
        const [sql] = parsi({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });
        expect(sql).toEqual('()');
    });

    it('should not parse with invalid name', () => {
        const [sql] = parsi({ 'id!': 1 }, {
            schema: defineFiltersSchema({
                allowed: undefined,
            }),
        });
        expect(sql).toEqual('()');
    });

    it('should parse invalid name if permitted by allowed', () => {
        const [sql, params] = parsi({ 'id!': 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id!'],
            }),
        });
        expect(sql).toEqual('"id!" = $1');
        expect(params).toEqual([1]);
    });

    it('should not parse empty input', () => {
        const [sql] = parsi({ name: '' }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });
        expect(sql).toEqual('()');
    });

    it('should parse null input', () => {
        let [sql, params] = parsi({ name: null });
        expect(sql).toEqual('"name" = $1');
        expect(params).toEqual([null]);

        [sql, params] = parsi({ name: 'null' });
        expect(sql).toEqual('"name" = $1');
        expect(params).toEqual([null]);
    });

    it('should not parse empty object', () => {
        const [sql] = parsi({});
        expect(sql).toEqual('()');
    });

    it('should parse with default', () => {
        let [sql, params] = parsi({ id: 1 }, {
            schema: defineFiltersSchema({
                default: { name: 'admin' },
            }),
        });
        expect(sql).toEqual('"name" = $1');
        expect(params).toEqual(['admin']);

        [sql, params] = parsi({ name: 'tada5hi' }, {
            schema: defineFiltersSchema({
                default: { name: 'admin' },
            }),
        });
        expect(sql).toEqual('"name" = $1');
        expect(params).toEqual(['tada5hi']);
    });

    it('should parse with default path', () => {
        const schema = defineFiltersSchema({
            allowed: ['id', 'display_name'],
            defaultPath: 'user',
        });

        let [sql, params] = parsi({ id: 1 }, { schema });

        expect(sql).toEqual('"user"."id" = $1');
        expect(params).toEqual([1]);

        [sql, params] = parsi({ display_name: 'admin' }, { schema });
        expect(sql).toEqual('"user"."display_name" = $1');
        expect(params).toEqual(['admin']);
    });

    it('should parse with validator', () => {
        let [sql, params] = parsi(
            { id: '1' },
            {
                schema: defineFiltersSchema({
                    allowed: ['id'],
                    validate: (key, value) => {
                        if (key === 'id') {
                            return typeof value === 'number';
                        }

                        return false;
                    },
                }),
            },
        );
        expect(sql).toEqual('"id" = $1');
        expect(params).toEqual([1]);

        [sql, params] = parsi(
            { id: '1,2,3' },
            {
                schema: defineFiltersSchema({
                    allowed: ['id'],
                    validate: (key, value) => {
                        if (key === 'id') {
                            return typeof value === 'number' &&
                            value > 1;
                        }

                        return false;
                    },
                }),
            },
        );
        expect(sql).toEqual('"id" in($1, $2)');
        expect(params).toEqual([2, 3]);
    });

    it('should parse with different number input', () => {
        const schema = defineFiltersSchema({
            allowed: ['id'],
        });

        // equal operator
        let [sql, params] = parsi({ id: '1' }, { schema });
        expect(sql).toEqual('"id" = $1');
        expect(params).toEqual([1]);

        // negation with equal operator
        [sql, params] = parsi({ id: '!1' }, { schema });
        expect(sql).toEqual('"id" <> $1');
        expect(params).toEqual([1]);

        // in operator
        [sql, params] = parsi({ id: 'null,0,1,2,3' }, { schema });
        expect(sql).toEqual('"id" in($1, $2, $3, $4, $5)');
        expect(params).toEqual([null, 0, 1, 2, 3]);

        // negation with in operator
        [sql, params] = parsi({ id: '!1,2,3' }, { schema });
        expect(sql).toEqual('"id" not in($1, $2, $3)');
        expect(params).toEqual([1, 2, 3]);

        // less than operator
        [sql, params] = parsi({ id: '<10' }, { schema });
        expect(sql).toEqual('"id" < $1');
        expect(params).toEqual([10]);

        // less than equal operator
        [sql, params] = parsi({ id: '<=10' }, { schema });
        expect(sql).toEqual('"id" <= $1');
        expect(params).toEqual([10]);

        // more than operator
        [sql, params] = parsi({ id: '>10' }, { schema });
        expect(sql).toEqual('"id" > $1');
        expect(params).toEqual([10]);

        // more than equal operator
        [sql, params] = parsi({ id: '>=10' }, { schema });
        expect(sql).toEqual('"id" >= $1');
        expect(params).toEqual([10]);
    });

    it('should parse different string inputs', () => {
        const schema = defineFiltersSchema({
            allowed: ['name'],
        });

        // like operator (start)
        let [sql, params] = parsi({ name: '~name' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['^name']);

        // like operator (end)
        [sql, params] = parsi({ name: 'name~' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['name$']);

        // like operator (start & end)
        [sql, params] = parsi({ name: '~name~' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['name']);

        // negation + like operator (start)
        [sql, params] = parsi({ name: '!~name' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['^(?!name).+']);

        // negation + like operator (end)
        [sql, params] = parsi({ name: '!name~' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['^(?!.*name$).*']);

        // negation + like operator (start & end)
        [sql, params] = parsi({ name: '!~name~' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['^(?!.*name).*']);
    });

    it('should parse with includes', () => {
        const relationsParser = new RelationsParser();
        const include = relationsParser.parse(
            ['profile', 'user_roles.role'],
            {
                schema: defineRelationsSchema({
                    allowed: ['profile', 'user_roles.role'],
                }),
            },
        );

        const schema = defineFiltersSchema({
            allowed: [
                'id',
                'profile.id',
                'user_roles.role.id',
            ],
        });

        // simple
        let [sql, params] = parsi({ id: 1, 'profile.id': 2 }, {
            schema,
            relations: include,
        });
        expect(sql).toEqual('("id" = $1 and "profile"."id" = $2)');
        expect(params).toEqual([1, 2]);

        // with include & query alias
        [sql, params] = parsi({ id: 1, 'profile.id': 2 }, { schema });
        expect(sql).toEqual('("id" = $1 and "profile"."id" = $2)');
        expect(params).toEqual([1, 2]);

        // todo: should be "role"."id" instead of "user_roles"."role.id"
        // with deep nested include
        [sql, params] = parsi({ id: 1, 'user_roles.role.id': 2 }, { schema });
        expect(sql).toEqual('("id" = $1 and "user_roles"."role.id" = $2)');
        expect(params).toEqual([1, 2]);
    });

    it('should throw on invalid input shape', () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
        });

        const error = FiltersParseError.inputInvalid();
        const evaluate = () => {
            parser.parse('foo', { schema });
        };
        expect(evaluate).toThrow(error);
    });

    it('should throw on invalid key value', () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
        });

        const error = FiltersParseError.keyValueInvalid('foo');
        const evaluate = () => {
            parser.parse({
                foo: Buffer.from('foo'),
            }, { schema });
        };
        expect(evaluate).toThrowError(error);
    });

    it('should throw on invalid key', () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
        });

        const error = FiltersParseError.keyInvalid('1foo');
        const evaluate = () => {
            parser.parse({
                '1foo': 1,
            }, { schema });
        };
        expect(evaluate).toThrow(error);
    });

    it('should throw on non allowed relation', () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
            allowed: ['user.foo'],
        });

        const error = FiltersParseError.keyPathInvalid('bar');
        const evaluate = () => {
            parser.parse({
                'bar.bar': 1,
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

    it('should throw on non allowed key which is not covered by a relation', () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
            allowed: ['user.foo'],
        });

        const error = FiltersParseError.keyInvalid('bar');
        const evaluate = () => {
            parser.parse({
                'user.bar': 1,
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

    it('should throw on non allowed key', () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
            allowed: ['foo'],
        });

        const error = FiltersParseError.keyInvalid('bar');
        const evaluate = () => {
            parser.parse({
                bar: 1,
            }, { schema });
        };
        expect(evaluate).toThrow(error);
    });
});
