/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { matchesInstanceof } from '@ebec/core';
import type { CacheError } from './module';

/**
 * Cross-realm brand, the `BASE_ERROR_MARKER` idiom of `@rapiq/core`:
 * `instanceof` compares class identity, which two copies of this package
 * in one process do not share, and the chain survives a JSON round trip.
 */
export const CACHE_ERROR_MARKER : unique symbol = Symbol.for('@rapiq/cache/error');

/**
 * Whether the value is an error this package raised.
 */
export function isCacheError(input: unknown) : input is CacheError {
    return matchesInstanceof(input, CACHE_ERROR_MARKER);
}
