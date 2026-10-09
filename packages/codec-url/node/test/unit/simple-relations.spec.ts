/*
 * Copyright (c) 2025-2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    Relation, 
    Relations,
} from '@rapiq/core';
import { SimpleURLDecoder, SimpleURLEncoder } from '../../src/simple';

describe('relations', () => {
    let encoder : SimpleURLEncoder;
    let decoder : SimpleURLDecoder;

    beforeAll(() => {
        encoder = new SimpleURLEncoder();
        decoder = new SimpleURLDecoder();
    });

    it('should encode & decode', async () => {
        const value = new Relations([
            new Relation('realm'),
        ]);

        const encoded = encoder.encodeRelations(value);
        const decoded = decoder.decodeRelations(encoded!);

        expect(value).toEqual(decoded);
    });

    it('should encode & decode nested', async () => {
        const value = new Relations([
            new Relation('roles'),
            new Relation('roles.realm'),
        ]);

        const encoded = encoder.encodeRelations(value);
        const decoded = decoder.decodeRelations(encoded!);

        expect(value).toEqual(decoded);
    });

    it('should encode & decode many', async () => {
        const value = new Relations([
            new Relation('realm'),
            new Relation('profile'),
        ]);

        const encoded = encoder.encodeRelations(value);
        const decoded = decoder.decodeRelations(encoded!);

        expect(value).toEqual(decoded);
    });
});
