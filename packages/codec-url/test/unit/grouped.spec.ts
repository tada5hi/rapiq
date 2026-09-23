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

    it('should refuse to encode groups instead of dropping them', () => {
        const error = capture(() => codec.encode(defineQuery({ groups: ['scope'] })));

        expect(error).toBeInstanceOf(AdapterError);
        expect(error.code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
        expect(error.feature).toBe('groups');
    });

    it('should refuse to encode aggregates instead of dropping them', () => {
        const error = capture(() => codec.encode(defineQuery({ aggregates: ['count'] }), { codec: URL_SIMPLE_CODEC }));

        expect(error.code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
        expect(error.feature).toBe('aggregates');
    });

    it('should refuse asynchronously as well', async () => {
        await expect(codec.encodeAsync(defineQuery({ groups: ['scope'], aggregates: ['count'] })))
            .rejects.toThrow(AdapterError.featureUnsupported('groups').message);
    });

    it('should still encode a plain query', () => {
        expect(codec.encode(defineQuery({ sorts: { name: 'ASC' } }), { stamp: false })).toEqual('sort=name');
    });
});
