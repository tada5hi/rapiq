/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral, SchemaRegistry } from '@rapiq/core';
import { URLParameter } from './constants';
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
 * A non-empty expression string — or a repeated filter parameter of
 * such strings, which is invalid but unmistakably expression-shaped
 * and must fail loudly there instead of being silently dropped —
 * claims an untagged payload for the expression dialect. An empty
 * `filter=` carries no dialect signal and stays with the tolerant
 * legacy branch.
 *
 * @param payload
 */
function isExpressionShaped(payload: ObjectLiteral) : boolean {
    const filters = payload[URLParameter.FILTERS];
    if (typeof filters === 'string') {
        return filters !== '';
    }

    return Array.isArray(filters) &&
        filters.length > 0 &&
        filters.every((entry) => typeof entry === 'string' && entry !== '');
}

/**
 * Any other defined filter (bracket/object input, or a zero-signal
 * empty string) is treated as legacy simple input, which drops what
 * it cannot read unless the schema opts into throwing.
 *
 * @param payload
 */
function isSimpleShaped(payload: ObjectLiteral) : boolean {
    return typeof payload[URLParameter.FILTERS] !== 'undefined' &&
        !isExpressionShaped(payload);
}

/**
 * Create the URL transport facade with both bundled dialects.
 * Expression is the v2 write default; simple remains available
 * explicitly and is recognized automatically while decoding legacy
 * bracket-filter payloads. Decoder/encoder instances are shared
 * between the registrations and the expression encoder's internal
 * validation pass.
 *
 * @param input
 */
export function createURLCodec(input?: SchemaRegistry) : URLCodec {
    const codec = new URLCodec();

    const simpleDecoder = new SimpleURLDecoder(input);
    const simpleEncoder = new SimpleURLEncoder(input, { decoder: simpleDecoder });

    const expressionDecoder = new ExpressionURLDecoder(input);
    const expressionEncoder = new ExpressionURLEncoder(input, {
        simple: simpleEncoder,
        decoder: expressionDecoder,
    });

    codec.register({
        name: URL_SIMPLE_CODEC,
        encoder: simpleEncoder,
        decoder: simpleDecoder,
        detect: isSimpleShaped,
    });

    codec.register({
        name: URL_EXPRESSION_CODEC,
        encoder: expressionEncoder,
        decoder: expressionDecoder,
        detect: isExpressionShaped,
    }, true);

    return codec;
}
