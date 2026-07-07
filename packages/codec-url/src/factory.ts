/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SchemaRegistry } from '@rapiq/core';
import {
    URLDecoder as ExpressionURLDecoder,
    URLEncoder as ExpressionURLEncoder,
    URL_EXPRESSION_CODEC,
} from '@rapiq/codec-url-expression';
import {
    URLDecoder as SimpleURLDecoder,
    URLEncoder as SimpleURLEncoder,
    URL_SIMPLE_CODEC,
} from '@rapiq/codec-url-simple';
import { URLCodecRegistry } from './module';

/**
 * Create a registry with the bundled dialects registered:
 * simple (the default for unstamped payloads) and expression.
 *
 * @param input
 */
export function createURLCodecRegistry(input?: SchemaRegistry) : URLCodecRegistry {
    const registry = new URLCodecRegistry();

    registry.register({
        name: URL_SIMPLE_CODEC,
        encoder: new SimpleURLEncoder(input),
        decoder: new SimpleURLDecoder(input),
    });

    registry.register({
        name: URL_EXPRESSION_CODEC,
        encoder: new ExpressionURLEncoder(input),
        decoder: new ExpressionURLDecoder(input),
    });

    return registry;
}
