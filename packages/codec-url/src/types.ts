/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IQuery,
    ObjectLiteral,
    ParseQueryOptions,
} from '@rapiq/core';

export interface IURLCodecEncoder {
    encode(input: IQuery, options?: ParseQueryOptions): string | null;
}

export interface IURLCodecDecoder {
    decode(input: string | ObjectLiteral, options?: ParseQueryOptions): IQuery | null;
}

/**
 * A registrable URL codec: a stable identifier plus the two wire
 * directions. The bundled dialects (@rapiq/codec-url-simple,
 * @rapiq/codec-url-expression) satisfy the encoder/decoder contracts
 * structurally; external codecs implement the same shape.
 */
export type URLCodec = {
    name: string,
    encoder: IURLCodecEncoder,
    decoder: IURLCodecDecoder,
};

export type URLCodecRegistryEncodeOptions = ParseQueryOptions & {
    /**
     * Name of the codec to encode with; the registry
     * default is used when omitted.
     */
    codec?: string,
};
