/*
 * Copyright (c) 2025-2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    Sort, Sorts,
} from '@rapiq/core';
import { URLDecoder, URLEncoder } from '../../src';

describe('sort', () => {
    let encoder : URLEncoder;
    let decoder : URLDecoder;

    beforeAll(() => {
        encoder = new URLEncoder();
        decoder = new URLDecoder();
    });

    it('should encode & decode ASC', async () => {
        const value = new Sorts([
            new Sort('name', 'ASC'),
        ]);

        const encoded = encoder.encodeSort(value);
        const decoded = decoder.decodeSort(encoded!);

        expect(value).toEqual(decoded);
    });

    it('should encode & decode DESC', async () => {
        const value = new Sorts([
            new Sort('name', 'DESC'),
        ]);

        const encoded = encoder.encodeSort(value);
        const decoded = decoder.decodeSort(encoded!);

        expect(value).toEqual(decoded);
    });

    it('should encode & decode many', async () => {
        const value = new Sorts([
            new Sort('priority', 'ASC'),
            new Sort('name', 'DESC'),
        ]);

        const encoded = encoder.encodeSort(value);
        const decoded = decoder.decodeSort(encoded!);

        expect(value).toEqual(decoded);
    });
});
