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
    parseQueryParameter, RelationsParseOutput, SortDirection, SortParseOutput,
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
    });

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
    })

    it('should parse field query parameter', () => {
        let value = parseQueryParameter(Parameter.FIELDS, ['id', 'name'], {allowed: ['id', 'name']});
        expect(value).toEqual([
            { key: 'id' },
            { key: 'name' },
        ] as FieldsParseOutput);
    });

    it('should parse filter query parameter', () => {
        let value = parseQueryParameter(Parameter.FILTERS, { name: 'tada5hi' }, {allowed: ['name']});
        expect(value).toEqual([{
            key: 'name',
            value: 'tada5hi',
            operator: FilterComparisonOperator.EQUAL
        }] as FiltersParseOutput);
    });

    it('should parse pagination query parameter', () => {
        let value = parseQueryParameter(Parameter.PAGINATION, { offset: 20, limit: 20 }, { maxLimit: 50 });
        expect(value).toEqual({ offset: 20, limit: 20 } as PaginationParseOutput);
    });

    it('should parse relation query parameter', () => {
        let value = parseQueryParameter<Parameter.RELATIONS, Record<string, any>>(Parameter.RELATIONS, 'profile', { allowed: ['profile'] });
        expect(value).toEqual([
            { key: 'profile', value: 'profile' },
        ] as RelationsParseOutput);
    });

    it('should parse sort query parameter', () => {
        let value = parseQueryParameter(Parameter.SORT, '-id', { allowed: ['id'] });
        expect(value).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);
    });
});
