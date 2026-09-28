/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export const CACHE_MAX_TTL_DEFAULT = 60_000;

/**
 * How many entries one `write` inspects for expiry. Entries carry their
 * own ttl and sit in no order, so the scan is bounded; tags are kept in
 * expiry order and every expired one is dropped from the front.
 */
export const MEMORY_CACHE_PRUNE_BUDGET = 16;
