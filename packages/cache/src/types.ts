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
     */
    onError?: (error: unknown) => void,
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
     * now on. Rethrows a driver failure: a lost bump is a correctness
     * problem the caller decides about.
     */
    invalidate(tags: string[]): Promise<void>;

    /**
     * Remove entries by key. Rethrows a driver failure.
     */
    drop(keys: string[]): Promise<void>;
}
