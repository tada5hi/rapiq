/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    DecoderFiltersParser,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
} from '../../../src';

describe('src/parser/filters-nested.ts', () => {
    let parser: DecoderFiltersParser;

    beforeAll(() => {
        parser = new DecoderFiltersParser();
    });

    it('should parse nested filters', async () => {
        // filter id
        const output = await parser.parse({
            '01:id': 1,
            '01:name': 'admin',
            '02:age': 15,
        });

        expect(output).toEqual(
            new Filters(FilterCompoundOperator.OR, [
                new Filters(FilterCompoundOperator.AND, [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                    new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
                ]),
                new Filters(FilterCompoundOperator.AND, [
                    new Filter(FilterFieldOperator.EQUAL, 'age', 15),
                ]),
            ]),
        );
    });
});
