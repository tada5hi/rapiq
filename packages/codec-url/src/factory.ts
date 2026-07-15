/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SchemaRegistry } from '@rapiq/core';
import {
    ExpressionURLDecoder,
    ExpressionURLEncoder,
} from './expression';
import { URL_EXPRESSION_CODEC } from './expression/constants';
import {
    SimpleURLDecoder,
    SimpleURLEncoder,
} from './simple';
import { URL_SIMPLE_CODEC } from './simple/constants';
import { URLCodec } from './module';

/**
 * Create the URL transport facade with both bundled dialects.
 * Expression is the v2 write default; simple remains available
 * explicitly and is recognized automatically while decoding legacy
 * bracket-filter payloads.
 *
 * @param input
 */
export function createURLCodec(input?: SchemaRegistry) : URLCodec {
    const codec = new URLCodec();

    codec.register({
        name: URL_SIMPLE_CODEC,
        encoder: new SimpleURLEncoder(input),
        decoder: new SimpleURLDecoder(input),
    });

    codec.register({
        name: URL_EXPRESSION_CODEC,
        encoder: new ExpressionURLEncoder(input),
        decoder: new ExpressionURLDecoder(input),
    }, true);

    return codec;
}
