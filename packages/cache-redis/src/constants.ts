/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export const REDIS_CACHE_PREFIX_DEFAULT = 'rapiq';

/**
 * The segment after the prefix that tells the three key families apart:
 * `<prefix>:e:<key>`, `<prefix>:t:<tag>`, `<prefix>:c`.
 */
export const RedisCacheKeySegment = {
    ENTRY: 'e',
    TAG: 't',
    CLOCK: 'c',
} as const;

/**
 * The fields of the entry hash.
 */
export const RedisCacheEntryField = {
    CLOCK: 'clock',
    TAGS: 'tags',
    VALUE: 'value',
} as const;

/**
 * The names the scripts are registered under on the client. They carry the
 * package name so a client shared with other code cannot collide with them.
 */
export const RedisCacheCommand = {
    WRITE: 'rapiqCacheWrite',
    READ: 'rapiqCacheRead',
    INVALIDATE: 'rapiqCacheInvalidate',
} as const;
