/*
 * Copyright (c) 2025-2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    Pagination,
} from '@rapiq/core';
import { SimpleURLDecoder, SimpleURLEncoder } from '../../src/simple';

describe('pagination', () => {
    let encoder : SimpleURLEncoder;
    let decoder : SimpleURLDecoder;

    beforeAll(() => {
        encoder = new SimpleURLEncoder();
        decoder = new SimpleURLDecoder();
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

    it('should throw for a zero or non-integer limit (outside the wire subset)', () => {
        expect(() => encoder.encodePagination(new Pagination(0)))
            .toThrowError(AdapterError);
        expect(() => encoder.encodePagination(new Pagination(2.5)))
            .toThrowError(AdapterError);
    });

    it('should throw for a negative offset', () => {
        expect(() => encoder.encodePagination(new Pagination(50, -1)))
            .toThrowError(AdapterError);
    });

    it('should omit the redundant zero offset from the wire', () => {
        const encoded = encoder.encodePagination(new Pagination(50, 0));

        expect(decodeURIComponent(encoded!)).toEqual('page[limit]=50');
    });
});
