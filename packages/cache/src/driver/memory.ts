/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { MEMORY_CACHE_PRUNE_BUDGET } from './constants';
import type { CacheEntry, ICacheDriver, MemoryCacheDriverOptions } from './types';
import { clampCacheTtl, isCacheTagWellFormed, resolveMaxTtl } from './utils';

type MemoryCacheEntry = {
    entry: CacheEntry,
    expiresAt: number,
};

type MemoryCacheTag = {
    version: number,
    expiresAt: number,
};

/**
 * The in-process driver: two Maps and a number. Every method runs to
 * completion inside one tick, which is what makes each step atomic.
 * Expiry is lazy (checked on read) plus a prune on write and invalidate:
 * a bounded scan of the entries, and every expired tag from the front of
 * the tag map.
 */
export class MemoryCacheDriver implements ICacheDriver {
    readonly maxTtl : number;

    protected entries : Map<string, MemoryCacheEntry>;

    protected tags : Map<string, MemoryCacheTag>;

    /**
     * `undefined` models an absent clock key: what a shared store reads
     * after a flush, and what the contract's lost-clock case simulates.
     */
    protected clockValue : number | undefined;

    constructor(options: MemoryCacheDriverOptions = {}) {
        this.maxTtl = resolveMaxTtl(options.maxTtl);
        this.entries = new Map();
        this.tags = new Map();
        this.clockValue = undefined;
    }

    async clock() : Promise<number> {
        return this.clockValue ?? 0;
    }

    async read<T>(key: string) : Promise<CacheEntry<T> | null> {
        const now = Date.now();

        const item = this.entries.get(key);
        if (!item || item.expiresAt <= now) {
            this.entries.delete(key);
            return null;
        }

        const { entry } = item;
        if (
            typeof this.clockValue === 'undefined' ||
            this.clockValue < entry.clock
        ) {
            return null;
        }

        for (const tag of entry.tags) {
            const version = this.readTag(tag, now);
            if (typeof version === 'undefined' || version > entry.clock) {
                // a tag version only ever grows, so the entry is dead for good.
                this.entries.delete(key);
                return null;
            }
        }

        return structuredClone(entry) as CacheEntry<T>;
    }

    async write<T>(key: string, entry: CacheEntry<T>, ttl: number) : Promise<boolean> {
        if (entry.tags.some((tag) => !isCacheTagWellFormed(tag))) {
            return false;
        }

        const now = Date.now();

        this.prune(now);

        if (typeof this.clockValue === 'undefined') {
            this.clockValue = 0;
        }

        const clock = this.clockValue;

        let refused = clock < entry.clock;
        for (const tag of entry.tags) {
            // an absent tag has an unknown history (evicted, or lapsed after
            // a bump), so it is re-created as bumped now, never as 0.
            const version = this.readTag(tag, now) ?? clock;
            // re-armed on every write, refused or not: the tag has to outlive
            // every entry that may still carry it.
            this.setTag(tag, version, now);

            if (version > entry.clock) {
                refused = true;
            }
        }

        if (refused) {
            return false;
        }

        this.entries.set(key, {
            entry: structuredClone(entry),
            expiresAt: now + clampCacheTtl(ttl, this.maxTtl),
        });

        return true;
    }

    async invalidate(tags: string[]) : Promise<void> {
        const now = Date.now();

        this.prune(now);

        const clock = (this.clockValue ?? 0) + 1;
        this.clockValue = clock;

        for (const tag of tags) {
            this.setTag(tag, clock, now);
        }
    }

    async drop(keys: string[]) : Promise<void> {
        for (const key of keys) {
            this.entries.delete(key);
        }
    }

    // ----------------------------------------------------

    protected readTag(tag: string, now: number) : number | undefined {
        const item = this.tags.get(tag);
        if (!item) {
            return undefined;
        }

        if (item.expiresAt <= now) {
            this.tags.delete(tag);
            return undefined;
        }

        return item.version;
    }

    /**
     * Every tag expires `maxTtl` after it was last set, so deleting before
     * setting keeps the map in expiry order and the prune can stop at the
     * first live tag.
     */
    protected setTag(tag: string, version: number, now: number) {
        this.tags.delete(tag);
        this.tags.set(tag, { version, expiresAt: now + this.maxTtl });
    }

    // ponytail: bounded entry scan; an LRU if the entry map ever matters
    protected prune(now: number) {
        // entries carry their own ttl and are in no order: a bounded scan.
        let budget = MEMORY_CACHE_PRUNE_BUDGET;
        for (const [key, item] of this.entries) {
            if (budget-- === 0) {
                break;
            }

            if (item.expiresAt <= now) {
                this.entries.delete(key);
            }
        }

        // tags are in expiry order (see setTag): drop every expired one from
        // the front and stop at the first live one. Unbounded on purpose: a
        // write inserts one tag per row it carries, and each tag is removed
        // at most once, so the cost is amortized O(1) per inserted tag.
        for (const [tag, item] of this.tags) {
            if (item.expiresAt > now) {
                break;
            }

            this.tags.delete(tag);
        }
    }
}
