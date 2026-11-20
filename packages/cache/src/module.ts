/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { PENDING_INVALIDATIONS_MAX, REPLAY_DELAY_MAX, REPLAY_DELAY_MIN } from './constants';
import type { CacheEntry, ICacheDriver } from './driver';
import { isCacheTtlValid } from './driver';
import { CacheError } from './errors';
import type { ITaggedCache, RememberOptions, TaggedCacheOptions } from './types';

/**
 * A tag of a failed invalidation: until `deadline` (the longest an entry
 * written before the failure can live) a hit carrying it is not trusted.
 * `generation` changes on every failure recording the tag again, so a
 * replay that sent an older generation does not settle it.
 */
type PendingInvalidation = {
    deadline: number,
    generation: number,
};

export class TaggedCache implements ITaggedCache {
    protected driver : ICacheDriver;

    protected ttl : number;

    protected onError : (error: unknown) => void;

    protected maxPendingInvalidations : number;

    protected pending : Map<string, PendingInvalidation> = new Map();

    protected generation = 0;

    /**
     * Until when no hit is trusted, since a tag of a failed invalidation
     * could not be kept: `maxTtl` after the last overflow.
     */
    protected overflowUntil = 0;

    protected replaying : Promise<void> | undefined;

    protected timer : ReturnType<typeof setTimeout> | undefined;

    protected delay = REPLAY_DELAY_MIN;

    protected disposed = false;

    constructor(options: TaggedCacheOptions) {
        this.driver = options.driver;
        this.ttl = options.ttl ?? options.driver.maxTtl;

        if (!isCacheTtlValid(this.ttl)) {
            throw CacheError.ttlInvalid(this.ttl);
        }

        this.maxPendingInvalidations = options.maxPendingInvalidations ?? PENDING_INVALIDATIONS_MAX;

        if (
            !Number.isFinite(this.maxPendingInvalidations) ||
            this.maxPendingInvalidations < 1
        ) {
            throw CacheError.maxPendingInvalidationsInvalid(this.maxPendingInvalidations);
        }

        this.onError = options.onError ?? (() => {});
    }

    get pendingInvalidations() : readonly string[] {
        this.prunePending();

        return Array.from(this.pending.keys());
    }

    async remember<T>(
        key: string,
        read: () => Promise<T>,
        options: RememberOptions<T>,
    ) : Promise<T> {
        const ttl = options.ttl ?? this.ttl;

        if (!isCacheTtlValid(ttl)) {
            throw CacheError.ttlInvalid(ttl);
        }

        let clock : number;

        try {
            const hit = await this.driver.read<T>(key);

            this.replayOpportunistically();

            // a hit carrying a pending tag may predate the lost bump: it is
            // a miss, and the fill below overwrites it.
            if (hit && this.isTrusted(hit)) {
                return hit.value;
            }

            // observed BEFORE the read: a bump landing while the read runs
            // makes the store refuse the entry, one landing after it moves
            // the tags past it.
            clock = await this.driver.clock();
        } catch (e) {
            this.onError(e);

            return read();
        }

        const value = await read();

        try {
            // derived inside the try: a derivation that cannot name the
            // dependencies must not store, but the read already succeeded,
            // so the value is answered uncached rather than thrown away.
            const tags = options.tags(value);

            await this.driver.write(key, {
                clock,
                tags,
                value,
            }, ttl);
        } catch (e) {
            this.onError(e);
        }

        return value;
    }

    async invalidate(tags: string[]) : Promise<void> {
        // the pending tags ride along: one bump settles them too.
        const snapshot = this.snapshotPending();
        const own = new Set(tags);
        const sent = [...tags];

        for (const tag of snapshot.keys()) {
            if (!own.has(tag)) {
                sent.push(tag);
            }
        }

        try {
            await this.driver.invalidate(sent);
        } catch (e) {
            this.recordFailedInvalidation(tags);

            throw CacheError.invalidationFailed(tags, e);
        }

        this.settle(snapshot);
    }

    async drop(keys: string[]) : Promise<void> {
        await this.driver.drop(keys);

        this.replayOpportunistically();
    }

    /**
     * Stop the replay timer; no timer is scheduled again. Failed
     * invalidations are still recorded, still turn the hits carrying them
     * into misses, and still replay after a successful driver call.
     */
    dispose() : void {
        this.disposed = true;

        this.clearTimer();
    }

    /**
     * Bump every live pending tag in one driver call. One replay runs at a
     * time: a caller arriving meanwhile shares it. Never rejects through a
     * driver failure: that is reported to `onError` and the next attempt
     * scheduled.
     */
    protected replay() : Promise<void> {
        if (!this.replaying) {
            this.replaying = this.replayPending()
                .finally(() => {
                    this.replaying = undefined;
                });
        }

        return this.replaying;
    }

    protected async replayPending() : Promise<void> {
        const snapshot = this.snapshotPending();

        if (snapshot.size === 0) {
            this.delay = REPLAY_DELAY_MIN;

            return;
        }

        const tags = Array.from(snapshot.keys());

        try {
            await this.driver.invalidate(tags);
        } catch (e) {
            this.schedule();

            this.report(CacheError.invalidationFailed(tags, e));

            return;
        }

        this.settle(snapshot);
    }

    protected replayOpportunistically() : void {
        if (this.pending.size === 0) {
            return;
        }

        this.replay().catch(() => {
            // replay reports its own failures; nothing may reject unhandled.
        });
    }

    /**
     * After a bump carrying `snapshot` landed: drop each tag still at the
     * generation that was sent. A tag recorded again meanwhile stays, since
     * the bump may have landed before the write that failed to bump it
     * committed.
     */
    protected settle(snapshot: Map<string, number>) : void {
        for (const [tag, generation] of snapshot) {
            if (this.pending.get(tag)?.generation === generation) {
                this.pending.delete(tag);
            }
        }

        if (this.pending.size === 0) {
            this.delay = REPLAY_DELAY_MIN;

            this.clearTimer();

            return;
        }

        this.schedule();
    }

    /**
     * The generation of every live pending tag.
     */
    protected snapshotPending() : Map<string, number> {
        this.prunePending();

        const snapshot = new Map<string, number>();

        for (const [tag, pending] of this.pending) {
            snapshot.set(tag, pending.generation);
        }

        return snapshot;
    }

    /**
     * Arm the replay timer unless one is armed, the set is empty or the
     * cache is disposed; every arming doubles the next delay up to
     * `REPLAY_DELAY_MAX`. The timer does not keep the process alive.
     */
    protected schedule() : void {
        if (
            this.disposed ||
            this.timer ||
            this.pending.size === 0
        ) {
            return;
        }

        const timer = setTimeout(() => {
            this.timer = undefined;

            this.replay().catch(() => {
                // replay reports its own failures; nothing may reject unhandled.
            });
        }, this.delay);

        this.delay = Math.min(this.delay * 2, REPLAY_DELAY_MAX);

        // a Node timer handle; a number in a browser.
        (timer as unknown as { unref?: () => void }).unref?.();

        this.timer = timer;
    }

    protected clearTimer() : void {
        if (!this.timer) {
            return;
        }

        clearTimeout(this.timer);

        this.timer = undefined;
    }

    /**
     * Keep the tags of a failed invalidation pending until `maxTtl` from
     * now. A tag already pending gets the new deadline and generation.
     * Tags beyond `maxPendingInvalidations` are not kept: they are reported
     * to `onError` and open the overflow window.
     */
    protected recordFailedInvalidation(tags: string[]) : void {
        this.prunePending();

        const now = Date.now();
        const deadline = now + this.driver.maxTtl;
        const dropped : string[] = [];

        for (const tag of new Set(tags)) {
            if (
                !this.pending.has(tag) &&
                this.pending.size >= this.maxPendingInvalidations
            ) {
                dropped.push(tag);

                continue;
            }

            this.generation++;

            this.pending.set(tag, { deadline, generation: this.generation });
        }

        this.schedule();

        if (dropped.length === 0) {
            return;
        }

        this.overflowUntil = now + this.driver.maxTtl;

        this.report(CacheError.invalidationsOverflowed(dropped));
    }

    /**
     * Whether a hit may be served: no overflow window is open and none of
     * its tags is pending.
     */
    protected isTrusted(entry: CacheEntry) : boolean {
        const now = Date.now();

        if (now < this.overflowUntil) {
            return false;
        }

        for (const tag of entry.tags) {
            const pending = this.pending.get(tag);

            if (pending) {
                if (pending.deadline > now) {
                    return false;
                }

                this.pending.delete(tag);
            }
        }

        return true;
    }

    /**
     * Forget every pending tag past its deadline: an entry written before
     * its failure has lapsed by then.
     */
    protected prunePending() : void {
        const now = Date.now();

        for (const [tag, pending] of this.pending) {
            if (pending.deadline <= now) {
                this.pending.delete(tag);
            }
        }
    }

    /**
     * `onError` for a failure nobody awaits: a throwing hook must not
     * replace the failure it was told about, nor reject a timer.
     */
    protected report(error: unknown) : void {
        try {
            this.onError(error);
        } catch {
            // the hook's own failure has nowhere else to go.
        }
    }
}
