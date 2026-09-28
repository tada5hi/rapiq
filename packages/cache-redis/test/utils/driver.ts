/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { CacheEntry } from '@rapiq/cache';
import { clampCacheTtl, isCacheTagWellFormed } from '@rapiq/cache';
import { RedisCacheDriver } from '../../src';

/**
 * The contract suite reasons about expiry at millisecond granularity
 * (`ttl - 1` alive, `ttl` gone), which a real wait against a server clock
 * cannot meet without flaking. This subclass keeps a virtual clock next to
 * the real driver: every write and invalidate records when Redis WOULD let
 * a key lapse, and `advance` deletes what lapsed. The Redis-side `PX` and
 * `PEXPIRE` are asserted separately, through `PTTL`, in the driver spec.
 */
export class VirtualClockRedisCacheDriver extends RedisCacheDriver {
    protected now : number;

    protected expiries : Map<string, number>;

    constructor(...args: ConstructorParameters<typeof RedisCacheDriver>) {
        super(...args);

        this.now = 0;
        this.expiries = new Map();
    }

    override async write<T>(key: string, entry: CacheEntry<T>, ttl: number) : Promise<boolean> {
        const accepted = await super.write(key, entry, ttl);

        // a malformed tag refuses the write before the script runs.
        if (entry.tags.some((tag) => !isCacheTagWellFormed(tag))) {
            return accepted;
        }

        // re-armed whether or not the write was accepted, like the script does.
        for (const tag of entry.tags) {
            this.expiries.set(this.tagKey(tag), this.now + this.maxTtl);
        }

        if (accepted) {
            this.expiries.set(this.entryKey(key), this.now + clampCacheTtl(ttl, this.maxTtl));
        }

        return accepted;
    }

    override async invalidate(tags: string[]) : Promise<void> {
        await super.invalidate(tags);

        for (const tag of tags) {
            this.expiries.set(this.tagKey(tag), this.now + this.maxTtl);
        }
    }

    async advance(ms: number) : Promise<void> {
        this.now += ms;

        const lapsed : string[] = [];
        for (const [key, expiresAt] of this.expiries) {
            if (expiresAt <= this.now) {
                lapsed.push(key);
            }
        }

        if (lapsed.length === 0) {
            return;
        }

        await this.client.del(...lapsed);
        for (const key of lapsed) {
            this.expiries.delete(key);
        }
    }

    async dropTag(tag: string) : Promise<void> {
        await this.client.del(this.tagKey(tag));
    }

    async dropClock() : Promise<void> {
        await this.client.del(this.clockKey());
    }

    entryKey(key: string) : string {
        return this.buildEntryKey(key);
    }

    tagKey(tag: string) : string {
        return this.buildTagKey(tag);
    }

    clockKey() : string {
        return this.buildClockKey();
    }
}
