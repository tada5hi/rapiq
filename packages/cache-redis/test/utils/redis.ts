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
 * Whether the environment demands a live Redis. CI sets `REDIS_REQUIRED` on
 * the test job, so a broken service or a wrong URL fails the suite instead
 * of skipping it green.
 */
export function isRedisRequired() : boolean {
    const value = process.env.REDIS_REQUIRED;
    return typeof value === 'string' && value !== '' && value !== '0' && value !== 'false';
}

/**
 * Whether a Redis answers at `REDIS_URL`. The specs gate on this rather
 * than on an environment flag, the way the TypeORM adapter's engine specs
 * key on the live connection. With `REDIS_REQUIRED` set an unreachable
 * Redis throws, which fails the spec file instead of skipping it.
 */
export async function isRedisAvailable() : Promise<boolean> {
    const client = createRedisClient();
    // a refused connection is the answer, not an unhandled error event.
    client.on('error', () => {});

    try {
        await client.connect();
        await client.ping();

        return true;
    } catch (e) {
        if (isRedisRequired()) {
            throw new Error(`REDIS_REQUIRED is set, but no Redis is reachable at ${REDIS_URL} (db ${REDIS_DB}).`, { cause: e });
        }

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
