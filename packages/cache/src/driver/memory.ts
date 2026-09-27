/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { CACHE_MAX_TTL_DEFAULT, MEMORY_CACHE_PRUNE_BUDGET } from './constants';
import type { CacheEntry, ICacheDriver, MemoryCacheDriverOptions } from './types';

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
 * Expiry is lazy (checked on read) plus a bounded prune on write.
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
        this.maxTtl = options.maxTtl ?? CACHE_MAX_TTL_DEFAULT;
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
        const now = Date.now();

        this.prune(now);

        if (typeof this.clockValue === 'undefined') {
            this.clockValue = 0;
        }

        let refused = this.clockValue < entry.clock;
        for (const tag of entry.tags) {
            const version = this.readTag(tag, now) ?? 0;
            // re-armed on every write, refused or not: the tag has to outlive
            // every entry that may still carry it.
            this.tags.set(tag, { version, expiresAt: now + this.maxTtl });

            if (version > entry.clock) {
                refused = true;
            }
        }

        if (refused) {
            return false;
        }

        this.entries.set(key, {
            entry: structuredClone(entry),
            expiresAt: now + Math.min(ttl, this.maxTtl),
        });

        return true;
    }

    async invalidate(tags: string[]) : Promise<void> {
        const now = Date.now();

        const clock = (this.clockValue ?? 0) + 1;
        this.clockValue = clock;

        for (const tag of tags) {
            this.tags.set(tag, { version: clock, expiresAt: now + this.maxTtl });
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

    // ponytail: bounded prune per write; an LRU if the map ever matters
    protected prune(now: number) {
        let budget = MEMORY_CACHE_PRUNE_BUDGET;

        for (const [key, item] of this.entries) {
            if (budget === 0) {
                return;
            }

            budget--;

            if (item.expiresAt <= now) {
                this.entries.delete(key);
            }
        }

        for (const [tag, item] of this.tags) {
            if (budget === 0) {
                return;
            }

            budget--;

            if (item.expiresAt <= now) {
                this.tags.delete(tag);
            }
        }
    }
}
