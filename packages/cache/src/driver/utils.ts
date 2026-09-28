/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { CacheError } from '../errors';
import { CACHE_MAX_TTL_DEFAULT } from './constants';

/**
 * The `maxTtl` a driver runs with: the default when none is given, refused
 * at construction when below one millisecond rather than on every write.
 */
export function resolveMaxTtl(input?: number) : number {
    const value = input ?? CACHE_MAX_TTL_DEFAULT;
    if (!Number.isFinite(value) || Math.floor(value) < 1) {
        throw CacheError.maxTtlInvalid(value);
    }

    return value;
}
