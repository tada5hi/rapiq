/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export const REDIS_CACHE_PREFIX_DEFAULT = 'rapiq';

/**
 * How long `RedisCacheDriver.ready()` waits for the client by default, in
 * milliseconds.
 */
export const REDIS_CACHE_READY_TIMEOUT_DEFAULT = 1_000;

/**
 * The longest delay a Node.js timer schedules, in milliseconds: anything
 * above it fires after 1 ms instead.
 */
export const REDIS_CACHE_READY_TIMEOUT_MAX = 2_147_483_647;

/**
 * The segment after the prefix that tells the three key families apart:
 * `<prefix>:e:<key>`, `<prefix>:t:<tag>`, `<prefix>:c`.
 */
export const RedisCacheKeySegment = {
    ENTRY: 'e',
    TAG: 't',
    CLOCK: 'c',
} as const;

