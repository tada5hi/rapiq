/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICacheDriver } from './driver';

export type TaggedCacheOptions = {
    driver: ICacheDriver,
    /**
     * Entry ttl in milliseconds. Default: the driver's `maxTtl`. Anything
     * but a finite number of at least 1 throws a `CacheError` here.
     */
    ttl?: number,
    /**
     * Where a driver failure on the read path (`clock`, `read`, `write`)
     * and a throwing `tags` derivation are reported. Default: dropped. The call falls through to the read
     * either way; a cache outage must not take the application down.
     * A failed replay of pending invalidations and tags the full pending
     * set could not keep are reported here too (a `CacheError` naming them
     * in `tags`); a throw from this hook on those paths is swallowed.
     */
    onError?: (error: unknown) => void,
    /**
     * How many tags of failed invalidations are kept pending at most.
     * Default: 1000. Past it, further tags are not kept (their bump is
     * lost, reported to `onError` as `CacheError.invalidationsOverflowed`)
     * and no hit is trusted and no fill stored until `maxTtl` plus 5 s after
     * the last overflow. Anything but an integer of at least 1 throws a
     * `CacheError` here.
     */
    maxPendingInvalidations?: number,
};

export type RememberOptions<T> = {
    /**
     * The tags the value depends on, derived from the value AFTER it was
     * read (a row's id is only known then). A throw here is reported to
     * `onError` and the value is returned unstored: a derivation that
     * cannot name its dependencies must not store, but the read already
     * succeeded and is not thrown away.
     */
    tags: (value: T) => string[],
    /**
     * Per-call ttl in milliseconds, clamped by the driver to its `maxTtl`.
     * Anything but a finite number of at least 1 makes `remember` throw a
     * `CacheError` before it reads.
     */
    ttl?: number,
};

export interface ITaggedCache {
    /**
     * The cached value for `key`, or the value `read` answers, stored under
     * the tags derived from it. The value is returned whether or not the
     * store accepted it.
     */
    remember<T>(key: string, read: () => Promise<T>, options: RememberOptions<T>): Promise<T>;

    /**
     * Bump the tags; every entry carrying one of them reads as a miss from
     * now on. Rejects on a driver failure with `CacheError.invalidationFailed`
     * (the tags in `tags`, the driver failure as `cause`). The tags stay
     * pending in this process (see `pendingInvalidations`) as far as the
     * pending set has room; tags beyond `maxPendingInvalidations` are not
     * kept and are reported to `onError` as
     * `CacheError.invalidationsOverflowed`.
     */
    invalidate(tags: string[]): Promise<void>;

    /**
     * The tags of failed invalidations not yet replayed and not yet past
     * their deadline (`maxTtl` plus 5 s after the last failure). A hit carrying one
     * of them is treated as a miss, and a value whose tags include one is
     * returned unstored.
     */
    readonly pendingInvalidations: readonly string[];

    /**
     * Remove entries by key. Rethrows a driver failure.
     */
    drop(keys: string[]): Promise<void>;

    /**
     * Stop replaying pending invalidations on a timer. Failed invalidations
     * are still recorded and bypassed, and still replay after a successful
     * driver call.
     */
    dispose(): void;
}



/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * A value a scoped tag can carry. Anything else (an object, an array, an
 * invalid Date, undefined) has no stable spelling both sides derive alike,
 * so it never produces a scoped tag and the reader falls back to the
 * collection.
 */
export type ScopedTagValue = string | number | boolean | Date | null;

/**
 * Canonical spelling of a scoped tag value, applied by reader and writer
 * alike: `collectQueryTags` / `rememberQuery` and the write side must be
 * handed the same function, or their tags no longer meet. It receives the
 * schema name, the column and the value, and answers the value to spell.
 */
export type ScopedTagValueNormalizer = (schema: string, column: string, value: ScopedTagValue) => ScopedTagValue;
