/*
 * Copyright (c) 2025-2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    Filter, FilterCompoundOperator, FilterFieldOperator, Filters,
} from '@rapiq/core';
import { URLDecoder, URLEncoder } from '../../src';

describe('filters', () => {
    let encoder : URLEncoder;
    let decoder : URLDecoder;

    beforeAll(() => {
        encoder = new URLEncoder();
        decoder = new URLDecoder();
    });

    it('should encode & decode eq filter', async () => {
        const filter = new Filter(
            FilterFieldOperator.EQUAL,
            'id',
            1,
        );

        const encoded = encoder.encodeFilter(filter);
        const decoded = decoder.decodeFilters(encoded!);

        expect(new Filters(
            FilterCompoundOperator.AND,
            [filter],
        )).toEqual(decoded);
    });

    it.each([
        [FilterFieldOperator.NOT_EQUAL, 'id', 1, '!1'],
        [FilterFieldOperator.LESS_THAN, 'age', 18, '<18'],
        [FilterFieldOperator.LESS_THAN_EQUAL, 'age', 18, '<=18'],
        [FilterFieldOperator.GREATER_THAN, 'age', 18, '>18'],
        [FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 18, '>=18'],
        [FilterFieldOperator.CONTAINS, 'name', 'foo', '~foo~'],
        [FilterFieldOperator.NOT_CONTAINS, 'name', 'foo', '!~foo~'],
        [FilterFieldOperator.STARTS_WITH, 'name', 'foo', 'foo~'],
        [FilterFieldOperator.NOT_STARTS_WITH, 'name', 'foo', '!foo~'],
        [FilterFieldOperator.ENDS_WITH, 'name', 'foo', '~foo'],
        [FilterFieldOperator.NOT_ENDS_WITH, 'name', 'foo', '!~foo'],
    ])('should encode & decode %s filter', async (operator, field, value, expected) => {
        const filter = new Filter(operator, field, value);

        const encoded = encoder.encodeFilter(filter);
        expect(decodeURIComponent(encoded!)).toEqual(`filter[${field}]=${expected}`);

        const decoded = decoder.decodeFilters(encoded!);

        expect(new Filters(
            FilterCompoundOperator.AND,
            [filter],
        )).toEqual(decoded);
    });
});
