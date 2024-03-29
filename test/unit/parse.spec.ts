/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FieldsParseOutput, FilterComparisonOperator,
    FiltersParseOutput,
    PaginationParseOutput,
    Parameter,
    ParseOutput,
    parseQuery,
    parseQueryFields,
    parseQueryFilters,
    parseQueryPagination,
    parseQueryRelations,
    parseQuerySort,
    RelationsParseOutput,
    SortDirection,
    SortParseOutput,
} from '../../src';

describe('src/parse.ts', () => {
    it('should parse query', () => {
        let value = parseQuery({
            fields: ['id', 'name'],
        }, {
            fields: {
                allowed: ['id']
            }
        });
        expect(value).toEqual({
            fields: [
                { key: 'id' },
            ],
        } as ParseOutput);

        value = parseQuery({
            [Parameter.FIELDS]: ['id', 'name'],
        });
        expect(value).toEqual({
            fields: [
                {key: 'id'},
                {key: 'name'}
            ]
        } as ParseOutput);

        value = parseQuery({
            [Parameter.FIELDS]: ['id', 'name'],
        }, {
            fields: {
                allowed: []
            }
        });
        expect(value).toEqual({
            fields: []
        } as ParseOutput);

        value = parseQuery({
            [Parameter.FIELDS]: ['id', 'name'],
            [Parameter.FILTERS]: { id: 1},
            [Parameter.PAGINATION]: { limit: 20 },
            [Parameter.RELATIONS]: ['relation'],
            [Parameter.SORT]: {id: 'DESC'},
        }, {
            fields: true,
            filters: true,
            pagination: true,
            relations: true,
            sort: true
        });
        expect(value).toEqual({
            fields: [
                {key: 'id'},
                {key: 'name'}
            ],
            filters: [
                {key: 'id', value: 1, operator: FilterComparisonOperator.EQUAL}
            ],
            pagination: {
                limit: 20,
                offset: 0
            },
            relations: [
                { key: 'relation', value: 'relation'}
            ],
            sort: [
                { key: 'id', value: 'DESC'}
            ]
        } as ParseOutput);

        value = parseQuery({
            [Parameter.FIELDS]: ['id', 'name'],
            [Parameter.FILTERS]: { id: 1},
            [Parameter.PAGINATION]: { limit: 20 },
            [Parameter.RELATIONS]: ['relation'],
            [Parameter.SORT]: {id: 'DESC'},
        }, {
            fields: false,
            filters: false,
            pagination: false,
            relations: false,
            sort: false
        });
        expect(value).toEqual({} as ParseOutput);
    });

    it('should parse query with defaults', () => {
        let value = parseQuery({
            fields: ['id', 'name'],
        }, {
            fields: {
                default: ['id']
            }
        });
        expect(value).toEqual({
            fields: [
                { key: 'id' },
            ],
        } as ParseOutput);

        value = parseQuery<{ id: number, name: string }>({}, {
            fields: {
                default: ['id', 'name']
            },
            filters: {
                default: {
                    id: 1
                }
            }
        });

        expect(value).toEqual({
            fields: [
                { key: 'id' },
                { key: 'name' }
            ],
            filters: [
                {key: 'id', value: 1, operator: FilterComparisonOperator.EQUAL }
            ]
        } as ParseOutput);
    })

    it('should parse query with default path', () => {
        let value = parseQuery({
            fields: ['id', 'name'],
        }, {
            defaultPath: 'user',
            fields: {
                allowed: ['id']
            }
        });
        expect(value).toEqual({
            defaultPath: 'user',
            fields: [
                { key: 'id', path: 'user' },
            ],
        } as ParseOutput);

        value = parseQuery<{id: string, name: string, realm: { display_name: string }}>({
            filters: {
                'realm.display_name': 'master'
            },
            include: ['realm']
        }, {
            defaultPath: 'user',
            filters: {
                allowed: [
                    'id',
                    'realm.display_name'
                ]
            },
            relations: {
                allowed: ['realm']
            }
        });
        expect(value).toEqual({
            defaultPath: 'user',
            filters: [
                { key: 'display_name', operator: FilterComparisonOperator.EQUAL, path: 'realm', value: 'master' },
            ],
            relations: [
                { key: 'realm', value: 'realm' }
            ]
        } as ParseOutput);
    })

    it('should parse field query parameter', () => {
        let value = parseQueryFields(['id', 'name'], {allowed: ['id', 'name']});
        expect(value).toEqual([
            { key: 'id' },
            { key: 'name' },
        ] as FieldsParseOutput);
    });

    it('should parse filter query parameter', () => {
        let value = parseQueryFilters( { name: 'tada5hi' }, {allowed: ['name']});
        expect(value).toEqual([{
            key: 'name',
            value: 'tada5hi',
            operator: FilterComparisonOperator.EQUAL
        }] as FiltersParseOutput);
    });

    it('should parse pagination query parameter', () => {
        let value = parseQueryPagination({ offset: 20, limit: 20 }, { maxLimit: 50 });
        expect(value).toEqual({ offset: 20, limit: 20 } as PaginationParseOutput);
    });

    it('should parse relation query parameter', () => {
        let value = parseQueryRelations('profile', { allowed: ['profile'] });
        expect(value).toEqual([
            { key: 'profile', value: 'profile' },
        ] as RelationsParseOutput);
    });

    it('should parse sort query parameter', () => {
        let value = parseQuerySort('-id', { allowed: ['id'] });
        expect(value).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);
    });
});
