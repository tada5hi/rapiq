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
 *     ttl = maxTtl if ttl is not finite or below 1, else min(ttl, maxTtl)
 *     any tag not well-formed UTF-16 -> false  (checked before anything is written)
 *     clock <- seed if absent
 *     for tag in entry.tags: tag <- clock if absent; tag ttl <- maxTtl
 *     if clock < entry.clock -> false          (the clock was lost and restarted)
 *     if any tag version > entry.clock -> false (a bump landed during the read)
 *     store entry with ttl -> true
 *
 * read(key):
 *     entry absent or expired -> null
 *     clock absent or clock < entry.clock -> null (may delete the entry: none is ever legitimately ahead)
 *     any tag absent -> null                   (eviction or flush is a miss, never "never bumped")
 *     any tag version > entry.clock -> null
 *     -> entry
 *
 * invalidate(tags):
 *     c = (clock, or seed if absent) + 1; clock <- c
 *     for tag in tags: tag <- c, ttl maxTtl
 * ```
 *
 * An absent tag has an unknown history: it was evicted, or it lapsed after
 * a bump. A read fails closed on it, and a write re-creates it at the
 * CURRENT clock, never at 0, as if it had been bumped just now. Every
 * entry still carrying it then reads as bumped, and a fill that observed
 * an older clock is refused. The price: the first fill of a tag the store
 * has never seen is refused when any bump, of any tag, landed during its
 * read; the next fill is accepted.
 *
 * The seed is what a store answers for a clock it does not hold. The
 * in-process driver seeds 0 (its clock is never lost). A shared store
 * seeds a value above anything it can have issued before, the server
 * time in microseconds for Redis, so a lost clock key restarts ABOVE
 * every entry and tag written before the loss, and a pre-loss entry can
 * never read as fresh again once the counter climbs back.
 */
export interface ICacheDriver {
    /**
     * The longest an entry, and every tag key, may live in milliseconds.
     * A `write` ttl above it is clamped.
     */
    readonly maxTtl: number;

    /**
     * The current logical clock. A store that holds none answers its seed
     * (0 for the in-process driver) and may persist it on the way.
     */
    clock(): Promise<number>;

    /**
     * The stored entry, or null when absent, expired or stale.
     */
    read<T>(key: string): Promise<CacheEntry<T> | null>;

    /**
     * Store atomically; false when refused. `ttl` in milliseconds; one
     * that is not finite or below 1 is taken as `maxTtl`.
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
