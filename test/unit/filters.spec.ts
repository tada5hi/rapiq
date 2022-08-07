/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FilterOperatorLabel, FiltersParseOptions, FiltersParseOutput, parseQueryFilters, parseQueryRelations,
} from '../../src';

describe('src/filter/index.ts', () => {
    it('should transform request filters', () => {
        // filter id
        let allowedFilter = parseQueryFilters({ id: 1 }, {allowed: ['id']});
        expect(allowedFilter).toEqual([{
            key: 'id',
            value: 1,
        }] as FiltersParseOutput);

        // filter none
        allowedFilter = parseQueryFilters({ id: 1 }, { allowed: [] });
        expect(allowedFilter).toEqual([] as FiltersParseOutput);

        // filter with alias
        allowedFilter = parseQueryFilters({ aliasId: 1 }, { aliasMapping: { aliasId: 'id' }, allowed: ['id'] });
        expect(allowedFilter).toEqual([{
            key: 'id',
            value: 1,
        }] as FiltersParseOutput);

        // filter with query alias
        allowedFilter = parseQueryFilters({ id: 1 }, { defaultAlias: 'user', allowed: ['id'] });
        expect(allowedFilter).toEqual([{
            alias: 'user',
            key: 'id',
            value: 1,
        }] as FiltersParseOutput);

        // filter allowed
        allowedFilter = parseQueryFilters({ name: 'tada5hi' }, { allowed: ['name'] });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: 'tada5hi',
        }] as FiltersParseOutput);

        // filter data with el empty value
        allowedFilter = parseQueryFilters({ name: '' }, { allowed: ['name'] });
        expect(allowedFilter).toEqual([] as FiltersParseOutput);

        // filter data with el null value
        allowedFilter = parseQueryFilters({ name: null }, { allowed: ['name'] });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: null,
        }] as FiltersParseOutput);

        allowedFilter = parseQueryFilters({ name: 'null' }, { allowed: ['name'] });
        expect(allowedFilter).toEqual([{
            key: 'name',
            value: null,
        }] as FiltersParseOutput);

        // filter wrong allowed
        allowedFilter = parseQueryFilters({ id: 1 }, { allowed: ['name'] });
        expect(allowedFilter).toEqual([] as FiltersParseOutput);

        // filter empty data
        allowedFilter = parseQueryFilters({}, { allowed: ['name'] });
        expect(allowedFilter).toEqual([] as FiltersParseOutput);
    });

    it('should transform filters with different operators', () => {
        // equal operator
        let data = parseQueryFilters({ id: '1' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                value: '1',
            },
        ] as FiltersParseOutput);

        // negation with equal operator
        data = parseQueryFilters({ id: '!1' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: {
                    [FilterOperatorLabel.NEGATION]: true,
                },
                value: '1',
            },
        ] as FiltersParseOutput);

        // in operator
        data = parseQueryFilters({ id: '1,2,3' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: {
                    [FilterOperatorLabel.IN]: true,
                },
                value: ['1', '2', '3'],
            },
        ] as FiltersParseOutput);

        // negation with in operator
        data = parseQueryFilters({ id: '!1,2,3' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: {
                    [FilterOperatorLabel.IN]: true,
                    [FilterOperatorLabel.NEGATION]: true,
                },
                value: ['1', '2', '3'],
            },
        ] as FiltersParseOutput);

        // like operator
        data = parseQueryFilters({ name: '~name' }, { allowed: ['name'] });
        expect(data).toEqual([
            {
                key: 'name',
                operator: {
                    [FilterOperatorLabel.LIKE]: true,
                },
                value: 'name',
            },
        ] as FiltersParseOutput);

        // less than operator
        data = parseQueryFilters({ id: '<10' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: {
                    [FilterOperatorLabel.LESS_THAN]: true,
                },
                value: '10',
            },
        ] as FiltersParseOutput);

        // less than equal operator
        data = parseQueryFilters({ id: '<=10' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: {
                    [FilterOperatorLabel.LESS_THAN_EQUAL]: true,
                },
                value: '10',
            },
        ] as FiltersParseOutput);

        // more than operator
        data = parseQueryFilters({ id: '>10' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: {
                    [FilterOperatorLabel.MORE_THAN]: true,
                },
                value: '10',
            },
        ] as FiltersParseOutput);

        // more than equal operator
        data = parseQueryFilters({ id: '>=10' }, { allowed: ['id'] });
        expect(data).toEqual([
            {
                key: 'id',
                operator: {
                    [FilterOperatorLabel.MORE_THAN_EQUAL]: true,
                },
                value: '10',
            },
        ] as FiltersParseOutput);

        // negation with like operator
        data = parseQueryFilters({ name: '!~name' }, { allowed: ['name'] });
        expect(data).toEqual([
            {
                key: 'name',
                operator: {
                    [FilterOperatorLabel.LIKE]: true,
                    [FilterOperatorLabel.NEGATION]: true,
                },
                value: 'name',
            },
        ] as FiltersParseOutput);
    });

    it('should transform filters with includes', () => {
        const include = parseQueryRelations(['profile', 'user_roles.role'], {allowed: ['profile', 'user_roles.role']});

        const options : FiltersParseOptions = {
            allowed: ['id', 'profile.id', 'role.id'],
            relations: include,
        };

        // simple
        let transformed = parseQueryFilters({ id: 1, 'profile.id': 2 }, options);
        expect(transformed).toEqual([
            {
                key: 'id',
                value: 1,
            },
            {
                alias: 'profile',
                key: 'id',
                value: 2,
            },
        ] as FiltersParseOutput);

        // with include & query alias
        transformed = parseQueryFilters({ id: 1, 'profile.id': 2 }, { ...options, defaultAlias: 'user' });
        expect(transformed).toEqual([
            {
                alias: 'user',
                key: 'id',
                value: 1,
            },
            {
                alias: 'profile',
                key: 'id',
                value: 2,
            },
        ] as FiltersParseOutput);

        // with deep nested include
        transformed = parseQueryFilters({ id: 1, 'role.id': 2 }, options);
        expect(transformed).toEqual([
            {
                key: 'id',
                value: 1,
            },
            {
                alias: 'role',
                key: 'id',
                value: 2,
            },
        ] as FiltersParseOutput);
    });
});
