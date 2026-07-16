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

    encodeAsync?(input: IQuery, options?: ParseQueryOptions): Promise<string | null>;
}

export interface IURLCodecDecoder {
    decode(input: string | ObjectLiteral, options?: ParseQueryOptions): IQuery | null;

    decodeAsync?(input: string | ObjectLiteral, options?: ParseQueryOptions): Promise<IQuery | null>;
}

/**
 * A registrable URL dialect: a stable identifier plus both wire
 * directions. The bundled simple and expression dialects satisfy
 * these contracts structurally; external codecs can do the same.
 */
export type URLCodecDefinition = {
    name: string,
    encoder: IURLCodecEncoder,
    decoder: IURLCodecDecoder,
    /**
     * Structural recognizer for untagged payloads: given the parsed
     * wire payload (reserved parameters already removed), return true
     * to claim it for this dialect. Definitions are probed in
     * registration order; when none claims a payload, the default
     * dialect decodes it.
     */
    detect?: (payload: ObjectLiteral) => boolean,
};

export type URLCodecEncodeOptions = ParseQueryOptions & {
    /**
     * Name of the codec to encode with; the facade
     * default is used when omitted.
     */
    codec?: string,
    /**
     * Stamp the codec identity onto the wire (reserved `codec`
     * parameter, default true). Disable when the receiver is not a
     * rapiq URL codec (e.g. a strict JSON:API endpoint); untagged
     * output is still recognized structurally on decode.
     */
    stamp?: boolean,
};
