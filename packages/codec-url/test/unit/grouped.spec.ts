/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { defineQuery } from '@rapiq/core';
import { URL_SIMPLE_CODEC, createURLCodec } from '../../src';

describe('grouped queries', () => {
    const codec = createURLCodec();

    it('should keep groups through an unbound schema-aware expression encode', () => {
        expect(codec.encode(defineQuery({ groups: ['scope'] }), { strict: true, stamp: false }))
            .toEqual('group=scope');
    });

    it('should round-trip groups and aggregates through the simple codec', () => {
        const encoded = codec.encode(
            defineQuery({ groups: ['scope'], aggregates: ['count'] }),
            { codec: URL_SIMPLE_CODEC },
        );

        const decoded = codec.decode(encoded!, { groups: true, aggregates: true });

        expect(decoded!.groups!.value.map((item) => item.key)).toEqual(['scope']);
        expect(decoded!.aggregates!.value.map((item) => item.key)).toEqual(['count']);
    });

    it('should keep aggregates through an unbound schema-aware simple encode', () => {
        expect(codec.encode(defineQuery({ aggregates: ['count'] }), {
            codec: URL_SIMPLE_CODEC,
            strict: true,
            stamp: false,
        })).toEqual('aggregate=count');
    });

    it('should keep both through an unbound schema-aware encode asynchronously', async () => {
        const encoded = await codec.encodeAsync(
            defineQuery({ groups: ['scope'], aggregates: ['count'] }),
            { strict: true, stamp: false },
        );

        expect(encoded).toEqual('group=scope&aggregate=count');
    });

    it('should still encode a plain query', () => {
        expect(codec.encode(defineQuery({ sorts: { name: 'ASC' } }), { stamp: false })).toEqual('sort=name');
    });
});
