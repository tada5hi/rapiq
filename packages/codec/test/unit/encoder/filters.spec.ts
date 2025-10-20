/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Filter, FilterCompoundOperator, FilterFieldOperator, Filters,
} from 'rapiq';
import { URLEncoder } from '../../../src';
import { URLDecoder } from '../../../src/url/decoder';

describe('encoder/filters', () => {
    let encoder : URLEncoder;
    let decoder : URLDecoder;

    beforeAll(() => {
        encoder = new URLEncoder();
        decoder = new URLDecoder();
    });

    it('should encode eq filter', async () => {
        const filter = new Filter(
            FilterFieldOperator.EQUAL,
            'id',
            1,
        );

        const encoded = encoder.encodeFilters(filter);
        const decoded = await decoder.decodeFilters(encoded);

        expect(new Filters(
            FilterCompoundOperator.AND,
            [filter],
        )).toEqual(decoded);
    });
});
