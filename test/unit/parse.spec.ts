/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FieldsParseOutput, Parameter, ParseOutput, parseQuery, parseQueryParameter,
} from '../../src';

describe('src/parse.ts', () => {
    it('should parse query', () => {
        let value = parseQuery({
            fields: ['id', 'name'],
        }, {
            [Parameter.FIELDS]: true,
        });

        expect(value).toEqual({
            fields: [
                { key: 'id' },
                { key: 'name' },
            ],
        } as ParseOutput);

        value = parseQuery({
            [Parameter.FIELDS]: ['id', 'name'],
        });

        expect(value).toEqual({
            [Parameter.FIELDS]: [
                { key: 'id' },
                { key: 'name' },
            ],
            [Parameter.FILTERS]: [],
            [Parameter.RELATIONS]: [],
            [Parameter.PAGINATION]: {},
            [Parameter.SORT]: [],
        } as ParseOutput);
    });

    it('should parse single query parameter', () => {
        const value = parseQueryParameter(Parameter.FIELDS, ['id', 'name']);
        expect(value).toEqual([
            { key: 'id' },
            { key: 'name' },
        ] as FieldsParseOutput);
    });
});
