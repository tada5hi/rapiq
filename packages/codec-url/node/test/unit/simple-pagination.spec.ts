/*
 * Copyright (c) 2025-2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    Pagination,
    ParseError,
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

    it('should tolerate a leading question mark', () => {
        // the parameter helpers share the main decode path's `url.search`
        // tolerance — a single leading `?` is stripped before qs parsing
        const decoded = decoder.decodePagination('?page[limit]=50');

        expect(decoded).toEqual(new Pagination(50, 0));
    });

    it('should reject a prototype-member pagination key that survives qs', () => {
        // qs drops `__proto__`/`constructor` bracket keys itself (they are
        // Object.prototype members), but keeps `prototype` under a safe
        // parent — the parser-level guard catches that residue on the wire
        expect(() => decoder.decodePagination('page[a][prototype][x]=1'))
            .toThrowError(ParseError);
    });

    it('should fall back to defaults for hostile keys qs already dropped', () => {
        // `__proto__`/`constructor` bracket structures never leave qs, so
        // the parser sees an absent parameter — defaults, no pollution
        const decoded = decoder.decodePagination('page[__proto__][polluted]=1');

        expect(decoded).toEqual(new Pagination());
        const probe: Record<string, unknown> = {};
        expect(probe.polluted).toBeUndefined();
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
