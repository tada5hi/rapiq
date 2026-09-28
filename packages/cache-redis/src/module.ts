/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { CacheEntry, ICacheDriver } from '@rapiq/cache';
import { resolveMaxTtl } from '@rapiq/cache';
import {
    REDIS_CACHE_PREFIX_DEFAULT,
    RedisCacheCommand,
    RedisCacheKeySegment,
} from './constants';
import {
    REDIS_CACHE_INVALIDATE_SCRIPT,
    REDIS_CACHE_READ_SCRIPT,
    REDIS_CACHE_WRITE_SCRIPT,
} from './scripts';
import type {
    RedisCacheClient,
    RedisCacheDriverOptions,
    RedisCacheEntryFields,
    RedisCacheScriptClient,
} from './types';

/**
 * The shared-store driver: the contract's three steps as three Lua scripts,
 * registered once on the client and executed by `EVALSHA`. An entry is a
 * hash of `clock`, `tags` (JSON) and `value` (JSON), so the read script
 * decodes the tag list and never the value.
 */
export class RedisCacheDriver implements ICacheDriver {
    readonly maxTtl : number;

    readonly prefix : string;

    protected client : RedisCacheScriptClient;

    constructor(options: RedisCacheDriverOptions) {
        this.maxTtl = resolveMaxTtl(options.maxTtl);
        this.prefix = options.prefix ?? REDIS_CACHE_PREFIX_DEFAULT;
        this.client = RedisCacheDriver.defineCommands(options.client);
    }

    async clock() : Promise<number> {
        const value = await this.client.get(this.buildClockKey());
        if (value === null) {
            return 0;
        }

        return Number(value);
    }

    async read<T>(key: string) : Promise<CacheEntry<T> | null> {
        const fields = await this.client[RedisCacheCommand.READ](
            2,
            this.buildEntryKey(key),
            this.buildClockKey(),
            this.buildTagKey(''),
        );

        if (!isEntryFields(fields)) {
            return null;
        }

        return {
            clock: Number(fields[0]),
            tags: JSON.parse(fields[1]) as string[],
            value: JSON.parse(fields[2]) as T,
        };
    }

    async write<T>(key: string, entry: CacheEntry<T>, ttl: number) : Promise<boolean> {
        const maxTtl = toMilliseconds(this.maxTtl);
        const keys = [
            this.buildEntryKey(key),
            this.buildClockKey(),
            ...entry.tags.map((tag) => this.buildTagKey(tag)),
        ];

        const accepted = await this.client[RedisCacheCommand.WRITE](
            keys.length,
            ...keys,
            entry.clock,
            Math.min(toMilliseconds(ttl), maxTtl),
            maxTtl,
            JSON.stringify(entry.tags),
            // JSON has no undefined, so an undefined value is stored as null.
            JSON.stringify(entry.value) ?? 'null',
        );

        return accepted === 1;
    }

    async invalidate(tags: string[]) : Promise<void> {
        const keys = [
            this.buildClockKey(),
            ...tags.map((tag) => this.buildTagKey(tag)),
        ];

        await this.client[RedisCacheCommand.INVALIDATE](
            keys.length,
            ...keys,
            toMilliseconds(this.maxTtl),
        );
    }

    async drop(keys: string[]) : Promise<void> {
        if (keys.length === 0) {
            return;
        }

        await this.client.del(...keys.map((key) => this.buildEntryKey(key)));
    }

    // ----------------------------------------------------

    protected buildEntryKey(key: string) : string {
        return `${this.prefix}:${RedisCacheKeySegment.ENTRY}:${key}`;
    }

    protected buildTagKey(tag: string) : string {
        return `${this.prefix}:${RedisCacheKeySegment.TAG}:${tag}`;
    }

    protected buildClockKey() : string {
        return `${this.prefix}:${RedisCacheKeySegment.CLOCK}`;
    }

    // ----------------------------------------------------

    /**
     * Registering the same name twice with the same source is harmless, so
     * two drivers (two prefixes) may share one client.
     */
    protected static defineCommands(client: RedisCacheClient) : RedisCacheScriptClient {
        client.defineCommand(RedisCacheCommand.WRITE, { lua: REDIS_CACHE_WRITE_SCRIPT });
        client.defineCommand(RedisCacheCommand.READ, { lua: REDIS_CACHE_READ_SCRIPT });
        client.defineCommand(RedisCacheCommand.INVALIDATE, { lua: REDIS_CACHE_INVALIDATE_SCRIPT });

        return client as RedisCacheScriptClient;
    }
}

/**
 * Redis takes an integer for PX and PEXPIRE.
 */
function toMilliseconds(value: number) : number {
    return Math.max(0, Math.floor(value));
}

function isEntryFields(input: unknown) : input is RedisCacheEntryFields {
    return Array.isArray(input) &&
        input.length === 3 &&
        input.every((field) => typeof field === 'string');
}
