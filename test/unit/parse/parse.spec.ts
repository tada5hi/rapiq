/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type {
    QueryParseOutput,

} from '../../../src';
import {
    FilterComparisonOperator,
    Parameter,
    SortDirection,
    defineSchema,
    parseQueryFields,
    parseQueryFilters,
    parseQueryPagination,
    parseQueryRelations,
    parseQuerySort,
} from '../../../src';

type ParseOutput = QueryParseOutput;

describe('src/parse.ts', () => {
    it('should parse with allowed', () => {
        const schema = defineSchema({
            fields: {
                allowed: ['id'],
            },
        });

        const output = schema.parseQuery({
            fields: ['id', 'name'],
        });

        expect(output).toEqual({
            fields: [
                { key: 'id' },
            ],
        } as ParseOutput);
    });

    it('should parse query without options', () => {
        const schema = defineSchema({});

        const output = schema.parseQuery({
            [Parameter.FIELDS]: ['id', 'name'],
        });
        expect(output).toEqual({
            fields: [
                { key: 'id' },
                { key: 'name' },
            ],
        } as ParseOutput);
    });

    it('should parse with empty fields allowed option', () => {
        const schema = defineSchema({
            fields: {
                allowed: [],
            },
        });
        const output = schema.parseQuery({
            [Parameter.FIELDS]: ['id', 'name'],
        });
        expect(output).toEqual({
            fields: [],
        } as ParseOutput);
    });

    it('should parse with all parameters defined', () => {
        const schema = defineSchema();
        const output = schema.parseQuery({
            [Parameter.FIELDS]: ['id', 'name'],
            [Parameter.FILTERS]: { id: 1 },
            [Parameter.PAGINATION]: { limit: 20 },
            [Parameter.RELATIONS]: ['relation'],
            [Parameter.SORT]: { id: 'DESC' },
        });

        expect(output).toEqual({
            fields: [
                { key: 'id' },
                { key: 'name' },
            ],
            filters: [
                { key: 'id', value: 1, operator: FilterComparisonOperator.EQUAL },
            ],
            pagination: {
                limit: 20,
                offset: 0,
            },
            relations: [
                { key: 'relation', value: 'relation' },
            ],
            sort: [
                { key: 'id', value: 'DESC' },
            ],
        } as ParseOutput);
    });

    it('should parse with all parameters disabled', () => {
        const schema = defineSchema();

        const output = schema.parseQuery({
            [Parameter.FIELDS]: ['id', 'name'],
            [Parameter.FILTERS]: { id: 1 },
            [Parameter.PAGINATION]: { limit: 20 },
            [Parameter.RELATIONS]: ['relation'],
            [Parameter.SORT]: { id: 'DESC' },
        }, {
            fields: false,
            filters: false,
            pagination: false,
            relations: false,
            sort: false,
        });

        expect(output).toEqual({});
    });

    it('should parse query with default fields', () => {
        const schema = defineSchema({
            fields: {
                default: ['id'],
            },
        });
        const value = schema.parseQuery({
            fields: ['id', 'name'],
        });

        expect(value).toEqual({
            fields: [
                { key: 'id' },
            ],
        } as ParseOutput);
    });

    it('should parse query with default fields & filters', () => {
        const schema = defineSchema<{ id: number, name: string }>({
            fields: {
                default: ['id', 'name'],
            },
            filters: {
                default: {
                    id: 1,
                },
            },
        });
        const value = schema.parseQuery({});

        expect(value).toEqual({
            fields: [
                { key: 'id' },
                { key: 'name' },
            ],
            filters: [
                { key: 'id', value: 1, operator: FilterComparisonOperator.EQUAL },
            ],
        } as ParseOutput);
    });

    it('should parse query with default path', () => {
        const schema = defineSchema({
            defaultPath: 'user',
            fields: {
                allowed: ['id'],
            },
        });
        const output = schema.parseQuery({
            fields: ['id', 'name'],
        });
        expect(output).toEqual({
            defaultPath: 'user',
            fields: [
                { key: 'id', path: 'user' },
            ],
        } as ParseOutput);
    });

    it('should parse query with default path & relations', () => {
        const schema = defineSchema<
        {
            id: string,
            name: string,
            realm: {
                display_name: string
            }
        }
        >({
            defaultPath: 'user',
            filters: {
                allowed: [
                    'id',
                    'realm.display_name',
                ],
            },
            relations: {
                allowed: ['realm'],
            },
        });

        const output = schema.parseQuery({
            filters: {
                'realm.display_name': 'master',
            },
            include: ['realm'],
        }, {
        });
        expect(output).toEqual({
            defaultPath: 'user',
            filters: [
                {
                    key: 'display_name', operator: FilterComparisonOperator.EQUAL, path: 'realm', value: 'master',
                },
            ],
            relations: [
                { key: 'realm', value: 'realm' },
            ],
        } as ParseOutput);
    });

    it('should parse field query parameter', () => {
        const value = parseQueryFields(['id', 'name'], { allowed: ['id', 'name'] });
        expect(value).toEqual([
            { key: 'id' },
            { key: 'name' },
        ] as FieldsParseOutput);
    });

    it('should parse filter query parameter', () => {
        const value = parseQueryFilters({ name: 'tada5hi' }, { allowed: ['name'] });
        expect(value).toEqual([{
            key: 'name',
            value: 'tada5hi',
            operator: FilterComparisonOperator.EQUAL,
        }] as FiltersParseOutput);
    });

    it('should parse pagination query parameter', () => {
        const value = parseQueryPagination({ offset: 20, limit: 20 }, { maxLimit: 50 });
        expect(value).toEqual({ offset: 20, limit: 20 } as PaginationParseOutput);
    });

    it('should parse relation query parameter', () => {
        const value = parseQueryRelations('profile', { allowed: ['profile'] });
        expect(value).toEqual([
            { key: 'profile', value: 'profile' },
        ] as RelationsParseOutput);
    });

    it('should parse sort query parameter', () => {
        const value = parseQuerySort('-id', { allowed: ['id'] });
        expect(value).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);
    });
});
