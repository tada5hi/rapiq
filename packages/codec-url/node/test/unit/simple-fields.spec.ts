/*
 * Copyright (c) 2025-2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    FieldOperator,
    Fields,
} from '@rapiq/core';
import { SimpleURLDecoder, SimpleURLEncoder } from '../../src/simple';

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

    it('should encode operators & resolve them on decode', async () => {
        const value = new Fields([
            new Field('id', FieldOperator.INCLUDE),
            new Field('name', FieldOperator.EXCLUDE),
            new Field('realm.name', FieldOperator.EXCLUDE),
        ]);

        const encoded = encoder.encodeFields(value);
        // fields[$root]=+id,-name&fields[realm]=-name
        expect(encoded).toEqual('fields%5B%24root%5D=%2Bid%2C-name&fields%5Brealm%5D=-name');

        // the operator prefixes are deltas against the receiving schema's
        // defaults: a schemaless decode resolves them via Fields.execute,
        // so an opt-in include flattens to a plain field and an exclusion
        // with no default set to subtract from drops.
        const decoded = decoder.decodeFields(encoded!);
        expect(decoded).toEqual(new Fields([
            new Field('id'),
        ]));
    });

    it('should decode the legacy __DEFAULT__ root group spelling', async () => {
        const blessed = decoder.decodeFields('fields[$root]=id,name&fields[realm]=name');
        const legacy = decoder.decodeFields('fields[__DEFAULT__]=id,name&fields[realm]=name');

        expect(blessed).toEqual(new Fields([
            new Field('id'),
            new Field('name'),
            new Field('realm.name'),
        ]));
        expect(legacy).toEqual(blessed);
    });
});
