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
});
