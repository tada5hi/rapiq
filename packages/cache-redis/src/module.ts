/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { CacheEntry, ICacheDriver } from '@rapiq/cache';
import {
    CacheError,
    clampCacheTtl,
    isCacheTagWellFormed,
    resolveMaxTtl,
} from '@rapiq/cache';
import {
    REDIS_CACHE_PREFIX_DEFAULT,
    RedisCacheKeySegment,
} from './constants';
import { RedisCacheCommand, RedisCacheScript } from './commands';
import type {
    RedisCacheClient,
    RedisCacheDriverOptions,
    RedisCacheEntryFields,
    RedisCacheScriptClient,
} from './types';

/**
 * The shared-store driver: the contract's steps as Lua scripts, registered
 * once on the client and executed by `EVALSHA`. An entry is a
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

        RedisCacheDriver.assertClient(options.client, this.prefix);
        this.client = RedisCacheDriver.defineCommands(options.client);
    }

    /**
     * Seeds the clock from the server time when the store holds none, so
     * a fill observes the value its write will compare against.
     */
    async clock() : Promise<number> {
        const value = await this.run(RedisCacheCommand.CLOCK, 1, this.buildClockKey());

        return Number(value);
    }

    async read<T>(key: string) : Promise<CacheEntry<T> | null> {
        // ioredis encodes a lone surrogate as U+FFFD, so two such keys
        // would share one entry: such a key is never cached.
        if (!isCacheTagWellFormed(key)) {
            return null;
        }

        const fields = await this.run(RedisCacheCommand.READ, 2, this.buildEntryKey(key), this.buildClockKey(), this.buildTagKey(''));

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
        // a lone surrogate survives JSON.stringify as an escape the read
        // script's cjson refuses, while ioredis encodes the key with U+FFFD:
        // stored, the entry could never be read back.
        if (!isCacheTagWellFormed(key) || entry.tags.some((tag) => !isCacheTagWellFormed(tag))) {
            return false;
        }

        const maxTtl = toMilliseconds(this.maxTtl);
        const keys = [
            this.buildEntryKey(key),
            this.buildClockKey(),
            ...entry.tags.map((tag) => this.buildTagKey(tag)),
        ];

        // JSON has no undefined, so an undefined value is stored as null.
        const value = JSON.stringify(entry.value) ?? 'null';
        const args = [
            ...keys,
            entry.clock,
            toMilliseconds(clampCacheTtl(ttl, this.maxTtl)),
            maxTtl,
            JSON.stringify(entry.tags),
            value,
        ];

        const accepted = await this.run(RedisCacheCommand.WRITE, keys.length, ...args);

        return accepted === 1;
    }

    async invalidate(tags: string[]) : Promise<void> {
        const keys = [
            this.buildClockKey(),
            ...tags.map((tag) => this.buildTagKey(tag)),
        ];

        await this.run(RedisCacheCommand.INVALIDATE, keys.length, ...keys, toMilliseconds(this.maxTtl));
    }

    async drop(keys: string[]) : Promise<void> {
        if (keys.length === 0) {
            return;
        }

        const wellFormed = keys.filter((key) => isCacheTagWellFormed(key));
        if (wellFormed.length > 0) {
            await this.client.del(...wellFormed.map((key) => this.buildEntryKey(key)));
        }
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
     * Refuses the two client setups that would disable the cache silently:
     * a client `keyPrefix`, which the read script never sees, and a cluster
     * prefix without a hash tag, whose keys land in different slots and
     * make every script fail with CROSSSLOT.
     */
    protected static assertClient(client: RedisCacheClient, prefix: string) {
        const { keyPrefix } = client.options;
        if (keyPrefix) {
            throw CacheError.clientKeyPrefixUnsupported(keyPrefix);
        }

        if (client.isCluster && !hasHashTag(prefix)) {
            throw CacheError.prefixHashTagMissing(prefix);
        }
    }

    /**
     * Registering the same name twice with the same source is harmless, so
     * two drivers (two prefixes) may share one client.
     */
    protected run(name: string, ...args: (string | number)[]) : Promise<unknown> {
        const script = this.client[name];
        if (typeof script === 'undefined') {
            throw new Error(`The cache script ${name} is not registered on the client.`);
        }

        return script.call(this.client, ...(args as [number, ...(string | number)[]]));
    }

    protected static defineCommands(client: RedisCacheClient) : RedisCacheScriptClient {
        for (const [name, lua] of Object.entries(RedisCacheScript)) {
            client.defineCommand(name, { lua });
        }

        return client as RedisCacheScriptClient;
    }
}

/**
 * Whether the prefix decides the slot of every key built from it: the
 * first `{` followed by a `}` with at least one character between them.
 */
function hasHashTag(prefix: string) : boolean {
    const start = prefix.indexOf('{');
    if (start === -1) {
        return false;
    }

    const end = prefix.indexOf('}', start + 1);
    return end > start + 1;
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
