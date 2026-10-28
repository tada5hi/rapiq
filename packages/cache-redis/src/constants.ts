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

