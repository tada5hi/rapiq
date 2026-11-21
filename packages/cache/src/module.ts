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
 * A tag of a failed invalidation: until `deadline` (`maxTtl` plus
 * `REPLAY_DELAY_MAX` after the failure, the longest an entry written before
 * it can live) a hit carrying it is not trusted.
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
     * Until when no hit is trusted and no fill stored, since a tag of a
     * failed invalidation could not be kept: the deadline that tag would
     * have had, counted from the last overflow.
     */
    protected overflowUntil = 0;

    protected replaying : Promise<void> | undefined;

    protected timer : ReturnType<typeof setTimeout> | undefined;

    protected delay = REPLAY_DELAY_MIN;

    protected disposed = false;

    /**
     * Until when a replay after a successful driver call is skipped: the
     * backoff of the last failed attempt. 0 once a bump lands.
     */
    protected nextAttemptAt = 0;

    /**
     * Failed invalidations recorded so far (overflowing ones included). A
     * fill during which it moved is never stored, whatever happened to the
     * tags since: its read may have seen the rows the lost bump retires.
     */
    protected failures = 0;

    /**
     * Bumps that settled at least one pending tag. A hit whose read spans
     * one is not trusted: the entry may have been read before the bump
     * landed, and the tag is no longer pending to say so.
     */
    protected settles = 0;

    /**
     * Pending tags forgotten at their deadline. A hit whose read spans one
     * is not trusted: the read may have captured the entry while the tag
     * still distrusted it.
     */
    protected expiries = 0;

    constructor(options: TaggedCacheOptions) {
        this.driver = options.driver;
        this.ttl = options.ttl ?? options.driver.maxTtl;

        if (!isCacheTtlValid(this.ttl)) {
            throw CacheError.ttlInvalid(this.ttl);
        }

        this.maxPendingInvalidations = options.maxPendingInvalidations ?? PENDING_INVALIDATIONS_MAX;

        if (
            !Number.isSafeInteger(this.maxPendingInvalidations) ||
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

        const startedAt = Date.now();
        const failuresAtStart = this.failures;
        const settlesAtStart = this.settles;
        const expiriesAtStart = this.expiries;

        let clock : number;

        try {
            const hit = await this.driver.read<T>(key);

            this.replayOpportunistically();

            // a hit carrying a pending tag may predate the lost bump, and so
            // may one read across a failure, a settle, the expiry of a
            // pending tag or the end of an overflow window: a miss,
            // answered by the read below. `isTrusted` runs first, since it
            // may forget an expired tag itself.
            if (
                hit &&
                this.isTrusted(hit) &&
                startedAt >= this.overflowUntil &&
                this.failures === failuresAtStart &&
                this.settles === settlesAtStart &&
                this.expiries === expiriesAtStart
            ) {
                return hit.value;
            }

            // observed BEFORE the read: a bump landing while the read runs
            // makes the store refuse the entry, one landing after it moves
            // the tags past it.
            clock = await this.driver.clock();

            this.replayOpportunistically();
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

            // the read may have begun before the write whose bump failed
            // (or was dropped) committed: answered, never stored, until the
            // tag settles or the overflow window closes. A failure recorded
            // while this fill ran rules it out for good, even once expired.
            if (
                !this.isStorable(tags) ||
                this.failures !== failuresAtStart
            ) {
                return value;
            }

            await this.driver.write(key, {
                clock,
                tags,
                value,
            }, ttl);

            this.replayOpportunistically();
        } catch (e) {
            this.onError(e);
        }

        return value;
    }

    async invalidate(tags: string[]) : Promise<void> {
        // copied once: a caller mutating its array meanwhile must not change
        // what is recorded and reported on failure.
        const requested = [...tags];
        // the pending tags ride along: one bump settles them too.
        const snapshot = this.snapshotPending();
        const own = new Set(requested);
        const sent = [...requested];

        for (const tag of snapshot.keys()) {
            if (!own.has(tag)) {
                sent.push(tag);
            }
        }

        try {
            await this.driver.invalidate(sent);
        } catch (e) {
            this.recordFailedInvalidation(requested);

            throw CacheError.invalidationFailed(requested, e);
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
            this.nextAttemptAt = 0;

            return;
        }

        const tags = Array.from(snapshot.keys());

        try {
            await this.driver.invalidate(tags);
        } catch (e) {
            this.backOff();

            this.report(CacheError.invalidationFailed(tags, e));

            return;
        }

        this.settle(snapshot);
    }

    protected replayOpportunistically() : void {
        if (
            this.pending.size === 0 ||
            Date.now() < this.nextAttemptAt
        ) {
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
     * committed. Every tag left was recorded by a failure after the
     * snapshot, whose backoff stands.
     */
    protected settle(snapshot: Map<string, number>) : void {
        let settled = false;

        for (const [tag, generation] of snapshot) {
            if (this.pending.get(tag)?.generation === generation) {
                this.pending.delete(tag);

                settled = true;
            }
        }

        if (settled) {
            this.settles++;
        }

        if (this.pending.size === 0) {
            this.delay = REPLAY_DELAY_MIN;
            this.nextAttemptAt = 0;

            this.clearTimer();

            return;
        }

        this.schedule();
    }

    /**
     * After a failed attempt: skip opportunistic replays for the delay the
     * next timer uses, and arm that timer. Without a timer (disposed) the
     * delay still doubles, so the window grows like the timer would.
     */
    protected backOff() : void {
        this.nextAttemptAt = Date.now() + this.delay;

        if (this.disposed) {
            this.delay = Math.min(this.delay * 2, REPLAY_DELAY_MAX);

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
        this.failures++;

        this.prunePending();

        const now = Date.now();
        // a write issued before the failure was recorded can still land
        // just after it: its entry outlives a bare maxTtl by that round trip.
        const deadline = now + this.driver.maxTtl + REPLAY_DELAY_MAX;
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

        this.backOff();

        if (dropped.length === 0) {
            return;
        }

        this.overflowUntil = deadline;

        this.report(CacheError.invalidationsOverflowed(dropped));
    }

    /**
     * Whether a hit may be served: no overflow window is open and none of
     * its tags is pending.
     */
    protected isTrusted(entry: CacheEntry) : boolean {
        return this.isStorable(entry.tags);
    }

    /**
     * Whether a value carrying the tags may be served or stored: no
     * overflow window is open and none of the tags is pending.
     */
    protected isStorable(tags: string[]) : boolean {
        if (Date.now() < this.overflowUntil) {
            return false;
        }

        return !this.hasPendingTag(tags);
    }

    /**
     * Whether any of the tags is pending and short of its deadline; an
     * expired one met on the way is forgotten.
     */
    protected hasPendingTag(tags: string[]) : boolean {
        const now = Date.now();

        for (const tag of tags) {
            const pending = this.pending.get(tag);

            if (pending) {
                if (pending.deadline > now) {
                    return true;
                }

                this.pending.delete(tag);
                this.expiries++;
            }
        }

        return false;
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
                this.expiries++;
            }
        }
    }

    /**
     * `onError` for a failure nobody awaits: a throwing hook must not
     * replace the failure it was told about, nor reject a timer, and an
     * async hook that rejects must not reject unhandled. The hook is not
     * awaited.
     */
    protected report(error: unknown) : void {
        try {
            const result : unknown = this.onError(error);

            if (
                result &&
                typeof (result as PromiseLike<unknown>).then === 'function'
            ) {
                (result as PromiseLike<unknown>).then(undefined, () => {
                    // the hook's own failure has nowhere else to go.
                });
            }
        } catch {
            // the hook's own failure has nowhere else to go.
        }
    }
}
