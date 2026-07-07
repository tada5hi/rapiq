/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { CodecError, isObject } from '@rapiq/core';
import type {
    IQuery,
    ObjectLiteral,
    ParseQueryOptions,
} from '@rapiq/core';
import { parse } from 'qs';
import { CODEC_PARAMETER } from './constants';
import type {
    URLCodec,
    URLCodecRegistryEncodeOptions,
} from './types';

/**
 * Dispatches between URL codec dialects via the in-band
 * {@link CODEC_PARAMETER}: encoding stamps the codec identity onto
 * the wire, decoding reads it and delegates to the matching codec.
 * A payload without the parameter falls back to the registry
 * default; a payload naming an unregistered codec fails loudly —
 * it must never silently mis-decode under another dialect.
 */
export class URLCodecRegistry {
    protected items : Map<string, URLCodec>;

    protected defaultName : string | undefined;

    constructor() {
        this.items = new Map();
    }

    /**
     * Register a codec. The first registered codec becomes the
     * default (used for unstamped payloads and stampless encodes)
     * unless a later one is registered with `asDefault`.
     *
     * @param codec
     * @param asDefault
     */
    register(codec: URLCodec, asDefault?: boolean) : void {
        this.items.set(codec.name, codec);

        if (asDefault || typeof this.defaultName === 'undefined') {
            this.defaultName = codec.name;
        }
    }

    has(name: string) : boolean {
        return this.items.has(name);
    }

    /**
     * Encode a query with the named codec (or the default) and stamp
     * the codec identity onto the wire.
     *
     * @param input
     * @param options
     */
    encode(input: IQuery, options: URLCodecRegistryEncodeOptions = {}) : string | null {
        const { codec: name, ...parseOptions } = options;

        const codec = this.resolve(name);
        const encoded = codec.encoder.encode(input, parseOptions);
        if (encoded === null) {
            return null;
        }

        return `${CODEC_PARAMETER}=${codec.name}&${encoded}`;
    }

    /**
     * Decode a query string or a pre-parsed query object (e.g. an
     * express req.query) with the codec its payload names — or the
     * default codec when the identity parameter is absent.
     *
     * @param input
     * @param options
     */
    decode(
        input: string | ObjectLiteral,
        options: ParseQueryOptions = {},
    ) : IQuery | null {
        const parsed = typeof input === 'string' ? parse(input) : input;
        if (!isObject(parsed)) {
            return null;
        }

        let name : string | undefined;

        const value = parsed[CODEC_PARAMETER];
        if (typeof value !== 'undefined') {
            if (typeof value !== 'string') {
                throw CodecError.notResolvable();
            }

            name = value;
        }

        const codec = this.resolve(name);

        // the registry owns the reserved parameter — delegated
        // decoders (especially external ones) must not see it.
        const { [CODEC_PARAMETER]: _, ...payload } = parsed;

        return codec.decoder.decode(payload, options);
    }

    protected resolve(name?: string) : URLCodec {
        const key = name ?? this.defaultName;
        if (typeof key === 'undefined') {
            throw CodecError.notResolvable();
        }

        const codec = this.items.get(key);
        if (typeof codec === 'undefined') {
            throw CodecError.notResolvable(key);
        }

        return codec;
    }
}
