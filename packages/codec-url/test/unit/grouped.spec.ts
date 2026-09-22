/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, ErrorCode, defineQuery } from '@rapiq/core';
import { URL_SIMPLE_CODEC, createURLCodec } from '../../src';

function capture(fn: () => unknown) : AdapterError {
    try {
        fn();
    } catch (e) {
        return e as AdapterError;
    }

    throw new Error('expected a throw');
}

describe('grouped queries', () => {
    const codec = createURLCodec();

    it('should refuse a schema-aware expression encode instead of dropping groups', () => {
        const error = capture(() => codec.encode(defineQuery({ groups: ['scope'] }), { strict: true }));

        expect(error).toBeInstanceOf(AdapterError);
        expect(error.code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
        expect(error.feature).toBe('groups');
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

    it('should refuse a schema-aware simple encode instead of dropping aggregates', () => {
        const error = capture(() => codec.encode(defineQuery({ aggregates: ['count'] }), {
            codec: URL_SIMPLE_CODEC,
            strict: true,
        }));

        expect(error.code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
        expect(error.feature).toBe('aggregates');
    });

    it('should refuse asynchronously as well', async () => {
        await expect(codec.encodeAsync(defineQuery({ groups: ['scope'], aggregates: ['count'] }), { strict: true }))
            .rejects.toThrow(AdapterError.featureUnsupported('groups').message);
    });

    it('should still encode a plain query', () => {
        expect(codec.encode(defineQuery({ sorts: { name: 'ASC' } }), { stamp: false })).toEqual('sort=name');
    });
});
