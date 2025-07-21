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
    defineFiltersSchema,
} from '../../../src';
import { registry } from '../../data/schema';

const interpreter = createSqlInterpreter(allInterpreters);

describe('src/filter/index.ts', () => {
    let parser : FiltersParser;

    beforeAll(() => {
        parser = new FiltersParser(registry);
    });

    const parsi = async <T extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options?: FiltersParseOptions<T>,
    ) => {
        const parsed = await parser.parse(input, options);

        return interpreter(parsed, {
            ...pg,
            joinRelation: () => true,
        });
    };

    it('should parse with allowed', async () => {
        // filter id
        const [sql, params] = await parsi({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id'],
            }),
        });

        expect(sql).toEqual('"id" = $1');
        expect(params).toEqual([1]);
    });

    it('should parse with allowed (underscore key)', async () => {
        // filter with underscore key
        const [sql, params] = await parsi({ display_name: 'admin' }, {
            schema: defineFiltersSchema({
                allowed: ['display_name'],
            }),
        });

        expect(sql).toEqual('"display_name" = $1');
        expect(params).toEqual(['admin']);
    });

    it('should parse with allowed (empty)', async () => {
        // filter none
        const [sql] = await parsi({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: [],
            }),
        });
        expect(sql).toEqual('()');
    });

    it('should parse with allowed (undefined)', async () => {
        // filter
        const [sql, params] = await parsi({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: undefined,
            }),
        });

        expect(sql).toEqual('"id" = $1');
        expect(params).toEqual([1]);
    });

    it('should parse with allowed & mapping', async () => {
        // filter with mapping
        const [sql, params] = await parsi({ aliasId: 1 }, {
            schema: defineFiltersSchema({
                mapping: { aliasId: 'id' },
                allowed: ['id'],
            }),
        });
        expect(sql).toEqual('"id" = $1');
        expect(params).toEqual([1]);
    });

    it('should not parse with non matching name', async () => {
        // filter wrong allowed
        const [sql] = await parsi({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });
        expect(sql).toEqual('()');
    });

    it('should not parse with invalid name', async () => {
        const [sql] = await parsi({ 'id!': 1 }, {
            schema: defineFiltersSchema({
                allowed: undefined,
            }),
        });
        expect(sql).toEqual('()');
    });

    it('should parse invalid name if permitted by allowed', async () => {
        const [sql, params] = await parsi({ 'id!': 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id!'],
            }),
        });
        expect(sql).toEqual('"id!" = $1');
        expect(params).toEqual([1]);
    });

    it('should not parse empty input', async () => {
        const [sql] = await parsi({ name: '' }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });
        expect(sql).toEqual('()');
    });

    it('should parse null input', async () => {
        let [sql, params] = await parsi({ name: null });
        expect(sql).toEqual('"name" = $1');
        expect(params).toEqual([null]);

        [sql, params] = await parsi({ name: 'null' });
        expect(sql).toEqual('"name" = $1');
        expect(params).toEqual([null]);
    });

    it('should not parse empty object', async () => {
        const [sql] = await parsi({});
        expect(sql).toEqual('()');
    });

    it('should parse with default', async () => {
        let [sql, params] = await parsi({ id: 1 }, {
            schema: defineFiltersSchema({
                default: { name: 'admin' },
            }),
        });
        expect(sql).toEqual('"name" = $1');
        expect(params).toEqual(['admin']);

        [sql, params] = await parsi({ name: 'tada5hi' }, {
            schema: defineFiltersSchema({
                default: { name: 'admin' },
            }),
        });
        expect(sql).toEqual('"name" = $1');
        expect(params).toEqual(['tada5hi']);
    });

    it('should parse with default path', async () => {
        const schema = defineFiltersSchema({
            allowed: ['id', 'display_name'],
            name: 'user',
        });

        let [sql, params] = await parsi({ id: 1 }, { schema });

        expect(sql).toEqual('"id" = $1');
        expect(params).toEqual([1]);

        [sql, params] = await parsi({ display_name: 'admin' }, { schema });
        expect(sql).toEqual('"display_name" = $1');
        expect(params).toEqual(['admin']);
    });

    it('should parse with validator', async () => {
        let [sql, params] = await parsi(
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

        [sql, params] = await parsi(
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

    it('should parse with different number input', async () => {
        const schema = defineFiltersSchema({
            allowed: ['id'],
        });

        // equal operator
        let [sql, params] = await parsi({ id: '1' }, { schema });
        expect(sql).toEqual('"id" = $1');
        expect(params).toEqual([1]);

        // negation with equal operator
        [sql, params] = await parsi({ id: '!1' }, { schema });
        expect(sql).toEqual('"id" <> $1');
        expect(params).toEqual([1]);

        // in operator
        [sql, params] = await parsi({ id: 'null,0,1,2,3' }, { schema });
        expect(sql).toEqual('"id" in($1, $2, $3, $4, $5)');
        expect(params).toEqual([null, 0, 1, 2, 3]);

        // negation with in operator
        [sql, params] = await parsi({ id: '!1,2,3' }, { schema });
        expect(sql).toEqual('"id" not in($1, $2, $3)');
        expect(params).toEqual([1, 2, 3]);

        // less than operator
        [sql, params] = await parsi({ id: '<10' }, { schema });
        expect(sql).toEqual('"id" < $1');
        expect(params).toEqual([10]);

        // less than equal operator
        [sql, params] = await parsi({ id: '<=10' }, { schema });
        expect(sql).toEqual('"id" <= $1');
        expect(params).toEqual([10]);

        // more than operator
        [sql, params] = await parsi({ id: '>10' }, { schema });
        expect(sql).toEqual('"id" > $1');
        expect(params).toEqual([10]);

        // more than equal operator
        [sql, params] = await parsi({ id: '>=10' }, { schema });
        expect(sql).toEqual('"id" >= $1');
        expect(params).toEqual([10]);
    });

    it('should parse different string inputs', async () => {
        const schema = defineFiltersSchema({
            allowed: ['name'],
        });

        // like operator (start)
        let [sql, params] = await parsi({ name: '~name' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['^name']);

        // like operator (end)
        [sql, params] = await parsi({ name: 'name~' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['name$']);

        // like operator (start & end)
        [sql, params] = await parsi({ name: '~name~' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['name']);

        // negation + like operator (start)
        [sql, params] = await parsi({ name: '!~name' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['^(?!name).+']);

        // negation + like operator (end)
        [sql, params] = await parsi({ name: '!name~' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['^(?!.*name$).*']);

        // negation + like operator (start & end)
        [sql, params] = await parsi({ name: '!~name~' }, { schema });
        expect(sql).toEqual('"name" ~* $1');
        expect(params).toEqual(['^(?!.*name).*']);
    });

    it('should parse with includes', async () => {
        // simple
        let [sql, params] = await parsi({ id: 1, 'realm.id': 2 }, {
            schema: 'user',
            relations: ['realm'],
            throwOnFailure: true,
        });
        expect(sql).toEqual('("id" = $1 and "realm"."id" = $2)');
        expect(params).toEqual([1, 2]);

        // with include & query alias
        [sql, params] = await parsi({ id: 1, 'realm.id': 2 }, { schema: 'user' });
        expect(sql).toEqual('("id" = $1 and "realm"."id" = $2)');
        expect(params).toEqual([1, 2]);

        // todo: should be "role"."id" instead of "user_roles"."role.id"
        // with deep nested include
        [sql, params] = await parsi({ id: 1, 'realm.item.id': 2 }, { schema: 'user' });
        expect(sql).toEqual('("id" = $1 and "realm"."item.id" = $2)');
        expect(params).toEqual([1, 2]);
    });

    it('should throw on invalid input shape', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
        });

        const error = FiltersParseError.inputInvalid();

        await expect(parser.parse('foo', { schema })).rejects.toThrow(error);
    });

    it('should throw on invalid key value', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
        });

        const error = FiltersParseError.keyValueInvalid('foo');

        await expect(parser.parse({
            foo: Buffer.from('foo'),
        }, { schema })).rejects.toThrow(error);
    });

    it('should throw on invalid key', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
        });

        const error = FiltersParseError.keyInvalid('1foo');

        await expect(parser.parse({
            '1foo': 1,
        }, { schema })).rejects.toThrow(error);
    });

    it('should throw on non allowed relation', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
            allowed: ['user.foo'],
        });

        const error = FiltersParseError.keyPathInvalid('bar');

        await expect(parser.parse({
            'bar.bar': 1,
        }, {
            schema,
            relations: ['user'],
        })).rejects.toThrow(error);
    });

    it('should throw on non allowed key which is not covered by a relation', async () => {
        const error = FiltersParseError.keyInvalid('bar');

        await expect(parser.parse({
            'realm.bar': 1,
        }, {
            schema: 'user',
            relations: ['realm'],
            throwOnFailure: true,
        })).rejects.toThrow(error);
    });

    it('should throw on non allowed key', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
            allowed: ['foo'],
        });

        const error = FiltersParseError.keyInvalid('bar');

        await expect(parser.parse({
            bar: 1,
        }, { schema })).rejects.toThrow(error);
    });
});
