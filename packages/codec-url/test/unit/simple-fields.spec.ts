/*
 * Copyright (c) 2025-2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
} from '@rapiq/core';
import { SimpleURLDecoder, SimpleURLEncoder } from '../../src/simple';

// todo: operator missing

describe('fields', () => {
    let encoder : SimpleURLEncoder;
    let decoder : SimpleURLDecoder;

    beforeAll(() => {
        encoder = new SimpleURLEncoder();
        decoder = new SimpleURLDecoder();
    });

    it('should encode & decode', async () => {
        const value = new Fields([
            new Field('id'),
        ]);

        const encoded = encoder.encodeFields(value);
        const decoded = decoder.decodeFields(encoded!);

        expect(value).toEqual(decoded);
    });

    it('should encode & decode many', async () => {
        const value = new Fields([
            new Field('id'),
            new Field('name'),
            new Field('realm.name'),
        ]);

        const encoded = encoder.encodeFields(value);
        const decoded = decoder.decodeFields(encoded!);

        expect(value).toEqual(decoded);
    });
});
