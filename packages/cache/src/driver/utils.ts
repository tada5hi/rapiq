/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { CacheError } from '../errors';
import { CACHE_MAX_TTL_DEFAULT } from './constants';

/**
 * Whether a ttl is a finite number of at least one millisecond. NaN and
 * Infinity are refused alike: `Number(undefined)` is NaN, and a NaN ttl
 * stores an entry that never expires.
 */
export function isCacheTtlValid(value: number) : boolean {
    return Number.isFinite(value) && value >= 1;
}

/**
 * The ttl a driver stores an entry with: the given one clamped to `maxTtl`,
 * or `maxTtl` itself when the given one is not a valid ttl. The cache
 * refuses such a ttl before it gets here; a driver still never lets one
 * produce an entry without an expiry.
 */
export function clampCacheTtl(ttl: number, maxTtl: number) : number {
    if (!isCacheTtlValid(ttl)) {
        return maxTtl;
    }

    return Math.min(ttl, maxTtl);
}

/**
 * The `maxTtl` a driver runs with: the default when none is given, refused
 * at construction when below one millisecond rather than on every write.
 */
export function resolveMaxTtl(input?: number) : number {
    const value = input ?? CACHE_MAX_TTL_DEFAULT;
    if (!isCacheTtlValid(value)) {
        throw CacheError.maxTtlInvalid(value);
    }

    return value;
}

const LONE_SURROGATE_REGEX = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * Whether a tag is well-formed UTF-16, i.e. carries no lone surrogate. A
 * lone surrogate has no UTF-8 encoding, so a store that encodes the tag
 * cannot read it back as the same tag; a write carrying one is refused.
 */
export function isCacheTagWellFormed(tag: string) : boolean {
    const { isWellFormed } = tag as { isWellFormed?: () => boolean };
    if (typeof isWellFormed === 'function') {
        return isWellFormed.call(tag);
    }

    return !LONE_SURROGATE_REGEX.test(tag);
}
