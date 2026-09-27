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
    client: RedisCacheClient,

    /**
     * The namespace every key of this store sits under. Default: `rapiq`.
     * Use a hash tag (`{rapiq}`) on a cluster.
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
 * The client after the three scripts were registered through `defineCommand`.
 * Every script takes the number of keys first, then the keys, then the rest.
 */
export type RedisCacheScriptClient = RedisCacheClient & {
    rapiqCacheWrite(numberOfKeys: number, ...args: (string | number)[]): Promise<number>,
    rapiqCacheRead(numberOfKeys: number, ...args: (string | number)[]): Promise<(string | null)[] | null>,
    rapiqCacheInvalidate(numberOfKeys: number, ...args: (string | number)[]): Promise<number>,
};
