/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import Redis from 'ioredis';

export const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/**
 * The suite flushes its database before every case, so it takes the last
 * one rather than the default 0 a developer's own data may live in.
 */
export const REDIS_DB = 15;

export function createRedisClient() : Redis {
    return new Redis(REDIS_URL, {
        db: REDIS_DB,
        lazyConnect: true,
        connectTimeout: 1_000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
    });
}

/**
 * Whether a Redis answers at `REDIS_URL`. The specs gate on this rather
 * than on an environment flag, the way the TypeORM adapter's engine specs
 * key on the live connection.
 */
export async function isRedisAvailable() : Promise<boolean> {
    const client = createRedisClient();
    // a refused connection is the answer, not an unhandled error event.
    client.on('error', () => {});

    try {
        await client.connect();
        await client.ping();

        return true;
    } catch {
        return false;
    } finally {
        client.disconnect();
    }
}

export function sleep(ms: number) : Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
