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
};

export type URLCodecEncodeOptions = ParseQueryOptions & {
    /**
     * Name of the codec to encode with; the facade
     * default is used when omitted.
     */
    codec?: string,
};
