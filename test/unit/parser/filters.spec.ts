/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { FiltersParseOutput } from '../../../src';
import {
    FilterComparisonOperator,
    FiltersParseError,
    FiltersParser,
    RelationsParser,
    defineFiltersSchema,
    defineRelationsSchema,
} from '../../../src';

describe('src/filter/index.ts', () => {
    let parser : FiltersParser;

    beforeAll(() => {
        parser = new FiltersParser();
    });

    it('should parse allowed filter', () => {
        // filter id
        const allowedFilter = parser.parse({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id'],
            }),
        });

        expect(allowedFilter).toEqual([{
            key: 'id',
            value: 1,
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);
    });

    it('should parse filter with underscore key', () => {
        // filter with underscore key
        const allowedFilter = parser.parse({ display_name: 'admin' }, {
            schema: defineFiltersSchema({
                allowed: ['display_name'],
            }),
        });
        expect(allowedFilter).toEqual([{
            key: 'display_name',
            value: 'admin',
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);
    });

    it('should parse filters (allowed: [])', () => {
        // filter none
        const allowedFilter = parser.parse({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: [],
            }),
        });
        expect(allowedFilter).toEqual([] as FiltersParseOutput);
    });

    it('should parse filters (allowed: undefined)', () => {
        // filter
        const allowedFilter = parser.parse({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: undefined,
            }),
        });
        expect(allowedFilter).toEqual([{
            key: 'id',
            value: 1,
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);
    });

    it('should parse filters with default', () => {
        let allowedFilter = parser.parse({ id: 1 }, {
            schema: defineFiltersSchema({
                default: { name: 'admin' },
            }),
        });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: 'admin',
            operator: FilterComparisonOperator.EQUAL,
        }] satisfies FiltersParseOutput);

        // invalid field name
        allowedFilter = parser.parse({ 'id!': 1 }, {
            schema: defineFiltersSchema({
                allowed: undefined,
            }),
        });
        expect(allowedFilter).toEqual([] satisfies FiltersParseOutput);

        // ignore field name pattern, if permitted by allowed key
        allowedFilter = parser.parse({ 'id!': 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id!'],
            }),
        });
        expect(allowedFilter).toEqual([{
            key: 'id!',
            value: 1,
            operator: FilterComparisonOperator.EQUAL,
        }] satisfies FiltersParseOutput);

        allowedFilter = parser.parse({ name: 'tada5hi' }, {
            schema: defineFiltersSchema({
                default: { name: 'admin' },
            }),
        });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: 'tada5hi',
            operator: FilterComparisonOperator.EQUAL,
        }] satisfies FiltersParseOutput);

        // filter with alias
        allowedFilter = parser.parse({ aliasId: 1 }, {
            schema: defineFiltersSchema({
                mapping: { aliasId: 'id' },
                allowed: ['id'],
            }),
        });
        expect(allowedFilter).toEqual([{
            key: 'id',
            value: 1,
            operator: FilterComparisonOperator.EQUAL,
        }] satisfies FiltersParseOutput);

        // filter with query alias
        allowedFilter = parser.parse({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id'],
            }),
        });
        expect(allowedFilter).toEqual([{
            key: 'id',
            value: 1,
            operator: FilterComparisonOperator.EQUAL,
        }] satisfies FiltersParseOutput);

        // filter allowed
        allowedFilter = parser.parse({ name: 'tada5hi' }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: 'tada5hi',
            operator: FilterComparisonOperator.EQUAL,
        }] satisfies FiltersParseOutput);

        // filter data with el empty value
        allowedFilter = parser.parse({ name: '' }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });
        expect(allowedFilter).toEqual([] satisfies FiltersParseOutput);

        // filter data with el null value
        allowedFilter = parser.parse({ name: null }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: null,
            operator: FilterComparisonOperator.EQUAL,
        }] satisfies FiltersParseOutput);

        allowedFilter = parser.parse({ name: 'null' }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: null,
            operator: FilterComparisonOperator.EQUAL,
        }] satisfies FiltersParseOutput);

        // filter wrong allowed
        allowedFilter = parser.parse({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });
        expect(allowedFilter).toEqual([] satisfies FiltersParseOutput);

        // filter empty data
        allowedFilter = parser.parse({}, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });
        expect(allowedFilter).toEqual([] satisfies FiltersParseOutput);
    });

    it('should transform fields with default path', () => {
        const schema = defineFiltersSchema({
            allowed: ['id', 'display_name'],
            defaultPath: 'user',
        });

        let data = parser.parse({ id: 1 }, { schema });

        expect(data).toEqual([
            {
                key: 'id',
                path: 'user',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] satisfies FiltersParseOutput);

        data = parser.parse({ display_name: 'admin' }, { schema });

        expect(data).toEqual([
            {
                key: 'display_name',
                path: 'user',
                value: 'admin',
                operator: FilterComparisonOperator.EQUAL,
            },
        ] satisfies FiltersParseOutput);
    });

    it('should transform filters with default', () => {
        const schema = defineFiltersSchema<{
            id: string,
            age: number
        }>({
            allowed: ['id', 'age'],
            default: {
                age: '<18',
            },
        });

        let data = parser.parse({ id: 1 }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] satisfies FiltersParseOutput);

        data = parser.parse({ name: 'Peter' }, { schema });
        expect(data).toEqual([
            {
                key: 'age',
                value: 18,
                operator: FilterComparisonOperator.LESS_THAN,
            },
        ] satisfies FiltersParseOutput);

        data = parser.parse({ age: 20 }, { schema });
        expect(data).toEqual([
            {
                key: 'age',
                value: 20,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] satisfies FiltersParseOutput);
    });

    it('should transform filters with default by element', () => {
        const schema = defineFiltersSchema({
            allowed: ['id', 'age'],
            default: {
                id: 18,
                age: '<18',
            },
            defaultByElement: true,
        });

        const data = parser.parse([], { schema });
        expect(data).toEqual([
            {
                key: 'id',
                value: 18,
                operator: FilterComparisonOperator.EQUAL,
            },
            {
                key: 'age',
                value: 18,
                operator: FilterComparisonOperator.LESS_THAN,
            },
        ] satisfies FiltersParseOutput);
    });

    it('should transform filters with default by element & default path', () => {
        const schema = defineFiltersSchema({
            allowed: ['id', 'age'],
            default: {
                id: 18,
                age: '<18',
            },
            defaultByElement: true,
            defaultPath: 'user',
        });

        const data = parser.parse({ id: 5 }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                path: 'user',
                value: 5,
                operator: FilterComparisonOperator.EQUAL,
            },
            {
                key: 'age',
                path: 'user',
                value: 18,
                operator: FilterComparisonOperator.LESS_THAN,
            },
        ] satisfies FiltersParseOutput);
    });

    it('should transform filters without default by element & default path', () => {
        const schema = defineFiltersSchema({
            allowed: ['id', 'age'],
            default: {
                id: 18,
                age: '<18',
            },
            defaultByElement: false,
            defaultPath: 'user',
        });

        const data = parser.parse({ id: 5 }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                path: 'user',
                value: 5,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] satisfies FiltersParseOutput);
    });

    it('should transform filters with validator', () => {
        let data = parser.parse(
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
        expect(data).toEqual([
            {
                key: 'id',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] satisfies FiltersParseOutput);

        data = parser.parse(
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
        expect(data).toEqual([
            { key: 'id', value: [2, 3], operator: FilterComparisonOperator.IN },
        ] satisfies FiltersParseOutput);
    });

    it('should transform filters with different operators (number)', () => {
        const schema = defineFiltersSchema({
            allowed: ['id'],
        });

        // equal operator
        let data = parser.parse({ id: '1' }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] satisfies FiltersParseOutput);

        // negation with equal operator
        data = parser.parse({ id: '!1' }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.NOT_EQUAL,
                value: 1,
            },
        ] satisfies FiltersParseOutput);

        // in operator
        data = parser.parse({ id: 'null,0,1,2,3' }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.IN,
                value: [null, 0, 1, 2, 3],
            },
        ] satisfies FiltersParseOutput);

        // negation with in operator
        data = parser.parse({ id: '!1,2,3' }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.NOT_IN,
                value: [1, 2, 3],
            },
        ] satisfies FiltersParseOutput);

        // less than operator
        data = parser.parse({ id: '<10' }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.LESS_THAN,
                value: 10,
            },
        ] satisfies FiltersParseOutput);

        // less than equal operator
        data = parser.parse({ id: '<=10' }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.LESS_THAN_EQUAL,
                value: 10,
            },
        ] satisfies FiltersParseOutput);

        // more than operator
        data = parser.parse({ id: '>10' }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.GREATER_THAN,
                value: 10,
            },
        ] satisfies FiltersParseOutput);

        // more than equal operator
        data = parser.parse({ id: '>=10' }, { schema });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.GREATER_THAN_EQUAL,
                value: 10,
            },
        ] satisfies FiltersParseOutput);
    });

    it('should transform filters with different operators (string)', () => {
        const schema = defineFiltersSchema({
            allowed: ['name'],
        });

        // like operator
        let data = parser.parse({ name: '~name' }, { schema });
        expect(data).toEqual([
            {
                key: 'name',
                operator: FilterComparisonOperator.LIKE,
                value: 'name',
            },
        ] satisfies FiltersParseOutput);

        // negation with like operator
        data = parser.parse({ name: '!~name' }, { schema });
        expect(data).toEqual([
            {
                key: 'name',
                operator: FilterComparisonOperator.NOT_LIKE,
                value: 'name',
            },
        ] satisfies FiltersParseOutput);
    });

    it('should transform filters with includes', () => {
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
            allowed: ['id', 'profile.id', 'user_roles.role.id'],
        });

        // simple
        let transformed = parser.parse({ id: 1, 'profile.id': 2 }, {
            schema,
            relations: include,
        });
        expect(transformed).toEqual([
            {
                key: 'id',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            },
            {
                path: 'profile',
                key: 'id',
                value: 2,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] satisfies FiltersParseOutput);

        // with include & query alias
        transformed = parser.parse({ id: 1, 'profile.id': 2 }, { schema });
        expect(transformed).toEqual([
            {
                key: 'id',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            },
            {
                path: 'profile',
                key: 'id',
                value: 2,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] satisfies FiltersParseOutput);

        // with deep nested include
        transformed = parser.parse({ id: 1, 'user_roles.role.id': 2 }, { schema });
        expect(transformed).toEqual([
            {
                key: 'id',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            },
            {
                path: 'user_roles.role',
                key: 'id',
                value: 2,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] satisfies FiltersParseOutput);
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
