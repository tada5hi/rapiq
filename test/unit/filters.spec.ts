/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FiltersParseOptions,
    FiltersParseOutput,
    parseQueryFilters,
    parseQueryRelations, FilterComparisonOperator, FiltersParseError,
} from '../../src';

describe('src/filter/index.ts', () => {
    it('should transform request filters', () => {
        // filter id
        let allowedFilter = parseQueryFilters({ id: 1 }, {allowed: ['id']});
        expect(allowedFilter).toEqual([{
            key: 'id',
            value: 1,
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        // filter with underscore key
        allowedFilter = parseQueryFilters({ display_name: 'admin' }, {allowed: ['display_name']});
        expect(allowedFilter).toEqual([{
            key: 'display_name',
            value: 'admin',
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        // filter none
        allowedFilter = parseQueryFilters({ id: 1 }, { allowed: [] });
        expect(allowedFilter).toEqual([] as FiltersParseOutput);

        // filter
        allowedFilter = parseQueryFilters({ id: 1 }, { allowed: undefined });
        expect(allowedFilter).toEqual([{
            key: 'id',
            value: 1,
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        allowedFilter = parseQueryFilters({ id: 1 }, { default: { name: 'admin' } });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: 'admin',
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        // invalid field name
        allowedFilter = parseQueryFilters({ 'id!': 1 }, { allowed: undefined });
        expect(allowedFilter).toEqual([] as FiltersParseOutput);

        // ignore field name pattern, if permitted by allowed key
        allowedFilter = parseQueryFilters({ 'id!': 1 }, { allowed: ['id!'] });
        expect(allowedFilter).toEqual([{
            key: 'id!',
            value: 1,
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        allowedFilter = parseQueryFilters({ name: 'tada5hi' }, { default: { name: 'admin' } });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: 'tada5hi',
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        // filter with alias
        allowedFilter = parseQueryFilters({ aliasId: 1 }, { mapping: { aliasId: 'id' }, allowed: ['id'] });
        expect(allowedFilter).toEqual([{
            key: 'id',
            value: 1,
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        // filter with query alias
        allowedFilter = parseQueryFilters({ id: 1 }, { allowed: ['id'] });
        expect(allowedFilter).toEqual([{
            key: 'id',
            value: 1,
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        // filter allowed
        allowedFilter = parseQueryFilters({ name: 'tada5hi' }, { allowed: ['name'] });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: 'tada5hi',
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        // filter data with el empty value
        allowedFilter = parseQueryFilters({ name: '' }, { allowed: ['name'] });
        expect(allowedFilter).toEqual([] as FiltersParseOutput);

        // filter data with el null value
        allowedFilter = parseQueryFilters({ name: null }, { allowed: ['name'] });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: null,
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        allowedFilter = parseQueryFilters({ name: 'null' }, { allowed: ['name'] });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: null,
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);

        // filter wrong allowed
        allowedFilter = parseQueryFilters({ id: 1 }, { allowed: ['name'] });
        expect(allowedFilter).toEqual([] as FiltersParseOutput);

        // filter empty data
        allowedFilter = parseQueryFilters({}, { allowed: ['name'] });
        expect(allowedFilter).toEqual([] as FiltersParseOutput);
    });

    it('should transform fields with default path', () => {
        const options : FiltersParseOptions= {
            allowed: ['id', 'display_name'],
            defaultPath: 'user'
        };

        let data = parseQueryFilters({ id: 1 }, options);

        expect(data).toEqual([
            {
                key: 'id',
                path: 'user',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            }
        ] as FiltersParseOutput)

        data = parseQueryFilters({ display_name: 'admin' }, options);

        expect(data).toEqual([
            {
                key: 'display_name',
                path: 'user',
                value: 'admin',
                operator: FilterComparisonOperator.EQUAL,
            }
        ] as FiltersParseOutput)
    })

    it('should transform filters with default', () => {
        const options : FiltersParseOptions<{id: string, age: number }> = {
            allowed: ['id', 'age'],
            default: {
                age: '<18'
            }
        };

        let data = parseQueryFilters({ id: 1 }, options);
        expect(data).toEqual([
            {
                key: 'id',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            }
        ] as FiltersParseOutput);

        data = parseQueryFilters({ name: 'Peter' }, options);
        expect(data).toEqual([
            {
                key: 'age',
                value: 18,
                operator: FilterComparisonOperator.LESS_THAN
            }
        ] as FiltersParseOutput);

        data = parseQueryFilters({age: 20}, options);
        expect(data).toEqual([
            {
                key: 'age',
                value: 20,
                operator: FilterComparisonOperator.EQUAL,
            }
        ] as FiltersParseOutput)
    });

    it('should transform filters with default by element', () => {
        const options: FiltersParseOptions = {
            allowed: ['id', 'age'],
            default: {
                id: 18,
                age: '<18',
            },
            defaultByElement: true
        };

        let data = parseQueryFilters([], options);
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
            }
        ] as FiltersParseOutput);

        data = parseQueryFilters({id: 5}, {...options, defaultPath: 'user'});
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
            }
        ] as FiltersParseOutput);

        data = parseQueryFilters({id: 5}, {...options, defaultByElement: false, defaultPath: 'user'});
        expect(data).toEqual([
            {
                key: 'id',
                path: 'user',
                value: 5,
                operator: FilterComparisonOperator.EQUAL,
            }
        ] as FiltersParseOutput);
    });

    it('should transform filters with validator', () => {
        let data = parseQueryFilters(
            { id: '1' },
            {
                allowed: ['id'],
                validate: (key, value) => {
                    if(key === 'id') {
                        return typeof value === 'number';
                    }

                    return false;
                }
            }
        );
        expect(data).toEqual([
            {
                key: 'id',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] as FiltersParseOutput);

        data = parseQueryFilters(
            { id: '1,2,3' },
            {
                allowed: ['id'],
                validate: (key, value) => {
                    if(key === 'id') {
                        return typeof value === 'number' &&
                            value > 1;
                    }

                    return false;
                }
            }
        );
        expect(data).toEqual([
            { key: 'id', value: [2, 3], operator: FilterComparisonOperator.IN, },
        ] as FiltersParseOutput);
    })

    it('should transform filters with different operators', () => {
        // equal operator
        let data = parseQueryFilters({ id: '1' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                value: 1,
                operator: FilterComparisonOperator.EQUAL,
            },
        ] as FiltersParseOutput);

        // negation with equal operator
        data = parseQueryFilters({ id: '!1' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.NOT_EQUAL,
                value: 1,
            },
        ] as FiltersParseOutput);

        // in operator
        data = parseQueryFilters({ id: 'null,0,1,2,3' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.IN,
                value: [null, 0, 1, 2, 3],
            },
        ] as FiltersParseOutput);

        // negation with in operator
        data = parseQueryFilters({ id: '!1,2,3' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.NOT_IN,
                value: [1, 2, 3],
            },
        ] as FiltersParseOutput);

        // like operator
        data = parseQueryFilters({ name: '~name' }, { allowed: ['name'] });
        expect(data).toEqual([
            {
                key: 'name',
                operator: FilterComparisonOperator.LIKE,
                value: 'name',
            },
        ] as FiltersParseOutput);

        // less than operator
        data = parseQueryFilters({ id: '<10' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.LESS_THAN,
                value: 10,
            },
        ] as FiltersParseOutput);

        // less than equal operator
        data = parseQueryFilters({ id: '<=10' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.LESS_THAN_EQUAL,
                value: 10,
            },
        ] as FiltersParseOutput);

        // more than operator
        data = parseQueryFilters({ id: '>10' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.GREATER_THAN,
                value: 10,
            },
        ] as FiltersParseOutput);

        // more than equal operator
        data = parseQueryFilters({ id: '>=10' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: FilterComparisonOperator.GREATER_THAN_EQUAL,
                value: 10,
            },
        ] as FiltersParseOutput);

        // negation with like operator
        data = parseQueryFilters({ name: '!~name' }, { allowed: ['name'] });
        expect(data).toEqual([
            {
                key: 'name',
                operator: FilterComparisonOperator.NOT_LIKE,
                value: 'name',
            },
        ] as FiltersParseOutput);
    });

    it('should transform filters with includes', () => {
        const include = parseQueryRelations(['profile', 'user_roles.role'], {
            allowed: ['profile', 'user_roles.role']
        });

        const options : FiltersParseOptions = {
            allowed: ['id', 'profile.id', 'user_roles.role.id'],
            relations: include,
        };

        // simple
        let transformed = parseQueryFilters({ id: 1, 'profile.id': 2 }, options);
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
        ] as FiltersParseOutput);

        // with include & query alias
        transformed = parseQueryFilters({ id: 1, 'profile.id': 2 }, options);
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
        ] as FiltersParseOutput);

        // with deep nested include
        transformed = parseQueryFilters({ id: 1, 'user_roles.role.id': 2 }, options);
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
        ] as FiltersParseOutput);
    });

    it('should throw on invalid input shape', () => {
        let options : FiltersParseOptions = {
            throwOnFailure: true
        }

        let error = FiltersParseError.inputInvalid();
        let evaluate = () => {
            parseQueryFilters('foo', options);
        }
        expect(evaluate).toThrowError(error);
    });

    it('should throw on invalid key value', () => {
        let options : FiltersParseOptions = {
            throwOnFailure: true
        }

        let error = FiltersParseError.keyValueInvalid('foo');
        let evaluate = () => {
            parseQueryFilters({
                foo: Buffer.from('foo'),
            }, options);
        }
        expect(evaluate).toThrowError(error);
    });

    it('should throw on invalid key', () => {
        let options : FiltersParseOptions = {
            throwOnFailure: true
        }

        let error = FiltersParseError.keyInvalid('1foo');
        let evaluate = () => {
            parseQueryFilters({
                '1foo': 1
            }, options);
        }
        expect(evaluate).toThrowError(error);
    });

    it('should throw on non allowed relation', () => {
        let options : FiltersParseOptions = {
            throwOnFailure: true,
            allowed: ['user.foo'],
            relations: [
                {
                    key: 'user',
                    value: 'user'
                }
            ]
        }

        let error = FiltersParseError.keyPathInvalid('bar');
        let evaluate = () => {
            parseQueryFilters({
                'bar.bar': 1
            }, options);
        }
        expect(evaluate).toThrowError(error);
    });

    it('should throw on non allowed key which is not covered by a relation', () => {
        let options : FiltersParseOptions = {
            throwOnFailure: true,
            allowed: ['user.foo'],
            relations: [
                {
                    key: 'user',
                    value: 'user'
                }
            ]
        }

        let error = FiltersParseError.keyInvalid('bar');
        let evaluate = () => {
            parseQueryFilters({
                'user.bar': 1
            }, options);
        }
        expect(evaluate).toThrowError(error);
    });

    it('should throw on non allowed key', () => {
        let options : FiltersParseOptions = {
            throwOnFailure: true,
            allowed: ['foo']
        }

        let error = FiltersParseError.keyInvalid('bar');
        let evaluate = () => {
            parseQueryFilters({
                bar: 1
            }, options);
        }
        expect(evaluate).toThrowError(error);
    });
});
