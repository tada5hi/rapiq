/*
 * Copyright (c) 2025-2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    Pagination,
} from '@rapiq/core';
import { URLDecoder, URLEncoder } from '../../src';

describe('pagination', () => {
    let encoder : URLEncoder;
    let decoder : URLDecoder;

    beforeAll(() => {
        encoder = new URLEncoder();
        decoder = new URLDecoder();
    });

    it('should encode & decode with limit', async () => {
        const value = new Pagination(50);

        const encoded = encoder.encodePagination(value);
        const decoded = decoder.decodePagination(encoded!);

        value.offset = 0;
        expect(value).toEqual(decoded);
    });

    it('should encode & decode with offset', async () => {
        const value = new Pagination(undefined, 50);

        const encoded = encoder.encodePagination(value);
        const decoded = decoder.decodePagination(encoded!);

        expect(value).toEqual(decoded);
    });

    it('should encode & decode with limit & offset', async () => {
        const value = new Pagination(50, 50);

        const encoded = encoder.encodePagination(value);
        const decoded = decoder.decodePagination(encoded!);

        expect(value).toEqual(decoded);
    });
});
