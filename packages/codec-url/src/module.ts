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
    URLCodecDefinition,
    URLCodecEncodeOptions,
} from './types';

/**
 * URL transport facade. Encoding uses the configured default dialect
 * and stamps its identity in-band. Decoding dispatches on that stamp;
 * untagged payloads are probed against the registered dialects'
 * `detect` hooks (in registration order) so, with the bundled setup,
 * legacy simple bracket filters and expression filters can coexist
 * during v2. A payload nothing claims decodes with the default.
 */
export class URLCodec {
    protected items : Map<string, URLCodecDefinition>;

    protected defaultName : string | undefined;

    constructor() {
        this.items = new Map();
    }

    /**
     * Register a dialect. The first registered dialect becomes the
     * default unless a later one is registered with `asDefault`.
     *
     * @param codec
     * @param asDefault
     */
    register(codec: URLCodecDefinition, asDefault?: boolean) : void {
        this.items.set(codec.name, codec);

        if (asDefault || typeof this.defaultName === 'undefined') {
            this.defaultName = codec.name;
        }
    }

    /**
     * Encode a query with the named codec (or the default) and stamp
     * the codec identity onto the wire (unless `stamp: false`).
     *
     * @param input
     * @param options
     */
    encode(input: IQuery, options: URLCodecEncodeOptions = {}) : string | null {
        const {
            codec: name,
            stamp,
            ...parseOptions
        } = options;

        const codec = this.resolve(name);
        const encoded = codec.encoder.encode(input, parseOptions);

        return this.stampEncoded(codec, encoded, stamp);
    }

    async encodeAsync(
        input: IQuery,
        options: URLCodecEncodeOptions = {},
    ) : Promise<string | null> {
        const {
            codec: name,
            stamp,
            ...parseOptions
        } = options;

        const codec = this.resolve(name);
        const encoded = codec.encoder.encodeAsync ?
            await codec.encoder.encodeAsync(input, parseOptions) :
            codec.encoder.encode(input, parseOptions);

        return this.stampEncoded(codec, encoded, stamp);
    }

    /**
     * Decode a query string or a pre-parsed query object (e.g. an
     * express req.query) with the dialect its payload names. Untagged
     * payloads are recognized structurally via the registered
     * dialects' `detect` hooks and otherwise fall back to the default.
     *
     * @param input
     * @param options
     */
    decode(
        input: string | ObjectLiteral,
        options: ParseQueryOptions = {},
    ) : IQuery | null {
        const prepared = this.prepareDecode(input);
        if (!prepared) {
            return null;
        }

        return prepared.codec.decoder.decode(prepared.payload, options);
    }

    async decodeAsync(
        input: string | ObjectLiteral,
        options: ParseQueryOptions = {},
    ) : Promise<IQuery | null> {
        const prepared = this.prepareDecode(input);
        if (!prepared) {
            return null;
        }

        return prepared.codec.decoder.decodeAsync ?
            prepared.codec.decoder.decodeAsync(prepared.payload, options) :
            prepared.codec.decoder.decode(prepared.payload, options);
    }

    protected prepareDecode(input: string | ObjectLiteral) : {
        codec: URLCodecDefinition,
        payload: ObjectLiteral,
    } | null {
        const parsed = typeof input === 'string' ? parse(input) : input;
        if (!isObject(parsed)) {
            return null;
        }

        let name : string | undefined;

        const value = parsed[CODEC_PARAMETER];
        if (
            typeof value !== 'undefined' &&
            value !== ''
        ) {
            if (typeof value !== 'string') {
                throw CodecError.notResolvable();
            }

            name = value;
        }

        // The facade owns the reserved parameter. Delegated decoders,
        // especially external ones, must never see it.
        const { [CODEC_PARAMETER]: _, ...payload } = parsed;

        if (typeof name === 'undefined') {
            for (const codec of this.items.values()) {
                if (codec.detect && codec.detect(payload)) {
                    return { codec, payload };
                }
            }
        }

        return {
            codec: this.resolve(name),
            payload,
        };
    }

    protected stampEncoded(
        codec: URLCodecDefinition,
        encoded: string | null,
        stamp?: boolean,
    ) : string | null {
        if (encoded === null || stamp === false) {
            return encoded;
        }

        return `${CODEC_PARAMETER}=${codec.name}&${encoded}`;
    }

    protected resolve(name?: string) : URLCodecDefinition {
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
