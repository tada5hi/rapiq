/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Cluster, Redis } from 'ioredis';

/**
 * A standalone client or a cluster; every script runs the same way on both,
 * a cluster only needs a hash-tagged prefix so the keys of one store share
 * a slot.
 */
export type RedisCacheClient = Redis | Cluster;

export type RedisCacheDriverOptions = {
    /**
     * A client WITHOUT a `keyPrefix`: the driver refuses one, since the read
     * script builds the tag keys itself and would never see that prefix.
     */
    client: RedisCacheClient,

    /**
     * The namespace every key of this store sits under. Default: `rapiq`.
     * A cluster client requires a hash tag (`{rapiq}`), so every key of the
     * store shares one slot; the driver refuses a cluster prefix without one.
     */
    prefix?: string,

    /**
     * The longest an entry, and every tag key, may live in milliseconds.
     * Default: 60000 (one minute).
     */
    maxTtl?: number,
};

/**
 * What the read script hands back: the three hash fields, each a string,
 * or null when the entry is absent, expired or stale.
 */
export type RedisCacheEntryFields = [clock: string, tags: string, value: string];

/**
 * The client after the scripts were registered through `defineCommand`.
 * Every script takes the number of keys first, then the keys, then the rest.
 */
export type RedisCacheScript = (numberOfKeys: number, ...args: (string | number)[]) => Promise<unknown>;

/**
 * The client after the scripts were registered through `defineCommand`,
 * under the hash-versioned names of `RedisCacheCommand`. Every script takes
 * the number of keys first, then the keys, then the rest.
 */
export type RedisCacheScriptClient = RedisCacheClient & Record<string, RedisCacheScript>;
