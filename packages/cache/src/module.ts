/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICacheDriver } from './driver';
import { isCacheTtlValid } from './driver';
import { CacheError } from './errors';
import type { ITaggedCache, RememberOptions, TaggedCacheOptions } from './types';

export class TaggedCache implements ITaggedCache {
    protected driver : ICacheDriver;

    protected ttl : number;

    protected onError : (error: unknown) => void;

    constructor(options: TaggedCacheOptions) {
        this.driver = options.driver;
        this.ttl = options.ttl ?? options.driver.maxTtl;
        if (!isCacheTtlValid(this.ttl)) {
            throw CacheError.ttlInvalid(this.ttl);
        }

        this.onError = options.onError ?? (() => {});
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
            if (hit) {
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
        await this.driver.invalidate(tags);
    }

    async drop(keys: string[]) : Promise<void> {
        await this.driver.drop(keys);
    }
}
