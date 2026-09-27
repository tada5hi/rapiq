/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * What a driver stores under one key: the value, the tags it depends on
 * and the logical clock the reader observed BEFORE it read the value.
 */
export type CacheEntry<T = unknown> = {
    clock: number,
    tags: string[],
    value: T,
};

/**
 * A store for tag-versioned entries over one logical clock.
 *
 * Every method is ONE atomic step against the store; none may be split
 * into round trips, because two writers racing an increment followed by a
 * set can leave a tag at the LOWER version.
 *
 * ```text
 * write(key, entry, ttl):
 *     ttl = min(ttl, maxTtl)
 *     clock <- 0 if absent
 *     for tag in entry.tags: tag <- 0 if absent; tag ttl <- maxTtl
 *     if clock < entry.clock -> false          (the clock was lost and restarted)
 *     if any tag version > entry.clock -> false (a bump landed during the read)
 *     store entry with ttl -> true
 *
 * read(key):
 *     entry absent or expired -> null
 *     clock absent or clock < entry.clock -> null
 *     any tag absent -> null                   (eviction or flush is a miss, never "never bumped")
 *     any tag version > entry.clock -> null
 *     -> entry
 *
 * invalidate(tags):
 *     c = clock + 1 (clock <- c)
 *     for tag in tags: tag <- c, ttl maxTtl
 * ```
 *
 * A tag key exists for every live entry and outlives it (`maxTtl` is at
 * least every entry ttl), so an absent tag can only mean eviction and
 * fails closed.
 */
export interface ICacheDriver {
    /**
     * The longest an entry, and every tag key, may live in milliseconds.
     * A `write` ttl above it is clamped.
     */
    readonly maxTtl: number;

    /**
     * The current logical clock, 0 when the store holds none.
     */
    clock(): Promise<number>;

    /**
     * The stored entry, or null when absent, expired or stale.
     */
    read<T>(key: string): Promise<CacheEntry<T> | null>;

    /**
     * Store atomically; false when refused. `ttl` in milliseconds.
     */
    write<T>(key: string, entry: CacheEntry<T>, ttl: number): Promise<boolean>;

    /**
     * Bump every tag to a fresh clock value, atomically.
     */
    invalidate(tags: string[]): Promise<void>;

    drop(keys: string[]): Promise<void>;
}

export type MemoryCacheDriverOptions = {
    /**
     * Default: 60000 (one minute).
     */
    maxTtl?: number,
};
