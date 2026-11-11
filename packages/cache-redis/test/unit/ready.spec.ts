/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { once } from 'node:events';
import Redis, { Cluster } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { isCacheError } from '@rapiq/cache';
import { RedisCacheDriver } from '../../src';
import type { RedisCacheClient } from '../../src';
import { REDIS_DB, REDIS_URL, isRedisAvailable } from '../utils/redis';

const available = await isRedisAvailable();

const PREFIX = 'rapiq-test';

/**
 * The client the README recommends: no offline queue, so a command issued
 * before the connection is ready rejects instead of waiting.
 */
const FAIL_FAST : RedisOptions = {
    db: REDIS_DB,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    commandTimeout: 300,
};

/**
 * Nothing listens on port 1, so every connection attempt is refused.
 */
const UNREACHABLE = 'redis://127.0.0.1:1';

function noop() {}

function track<T extends RedisCacheClient>(clients: RedisCacheClient[], client: T) : T {
    // a refused connection is the expected answer, not an unhandled error event.
    client.on('error', noop);
    clients.push(client);

    return client;
}

async function waitForEnd(client: RedisCacheClient) : Promise<void> {
    if (client.status !== 'end') {
        await once(client, 'end');
    }
}

async function measure<T>(promise: Promise<T>) : Promise<{ value: T, elapsed: number }> {
    const start = performance.now();
    const value = await promise;

    return { value, elapsed: performance.now() - start };
}

describe('src/module.ts (ready, no server)', () => {
    const clients : RedisCacheClient[] = [];

    afterEach(() => {
        for (const client of clients.splice(0)) {
            client.disconnect();
        }
    });

    it('should refuse a timeout that is not a finite number of at least 0 ms', () => {
        const client = track(clients, new Redis({ lazyConnect: true }));
        const driver = new RedisCacheDriver({ client });

        for (const timeout of [-1, NaN, Infinity]) {
            let error : unknown;

            try {
                driver.ready(timeout);
            } catch (e) {
                error = e;
            }

            expect(isCacheError(error)).toBeTruthy();
            expect((error as Error).message).toMatch(/timeout/);
        }

        // the refusal never connected the client.
        expect(client.status).toEqual('wait');
    });

    it('should settle false as soon as a client without retries ends', async () => {
        const client = track(clients, new Redis(UNREACHABLE, { ...FAIL_FAST, retryStrategy: () => null }));
        const driver = new RedisCacheDriver({ client });

        const { value, elapsed } = await measure(driver.ready(5_000));

        expect(value).toEqual(false);
        expect(elapsed).toBeLessThan(1_000);
        expect(client.status).toEqual('end');
        expect(client.listenerCount('ready')).toEqual(0);
        expect(client.listenerCount('end')).toEqual(0);
    });

    it('should settle false on the timeout while a retrying client keeps failing', async () => {
        const client = track(clients, new Redis(UNREACHABLE, { ...FAIL_FAST, retryStrategy: () => 20 }));
        const driver = new RedisCacheDriver({ client });

        const { value, elapsed } = await measure(driver.ready(300));

        expect(value).toEqual(false);
        expect(elapsed).toBeGreaterThanOrEqual(290);
        expect(client.status).not.toEqual('end');
    });

    it('should leave no listener behind after many calls', async () => {
        const client = track(clients, new Redis(UNREACHABLE, { ...FAIL_FAST, retryStrategy: () => 5 }));
        const driver = new RedisCacheDriver({ client });

        const pending = Array.from({ length: 30 }, () => driver.ready(20));

        // concurrent waiters share one listener pair, so they never trip
        // the MaxListenersExceededWarning of the client.
        expect(client.listenerCount('end')).toEqual(1);

        await Promise.all(pending);

        for (let i = 0; i < 30; i++) {
            expect(await driver.ready(i % 3)).toEqual(false);
        }

        // ioredis itself never listens for `end` on the client, and holds at
        // most one `ready` listener of its own per connection attempt.
        expect(client.listenerCount('end')).toEqual(0);
        expect(client.listenerCount('ready')).toBeLessThanOrEqual(1);
    });

    it('should answer false for a client the application closed, without reconnecting it', async () => {
        const client = track(clients, new Redis({ lazyConnect: true }));
        const driver = new RedisCacheDriver({ client });

        client.disconnect();
        await waitForEnd(client);

        const { value, elapsed } = await measure(driver.ready(5_000));

        expect(value).toEqual(false);
        expect(elapsed).toBeLessThan(100);
        expect(client.status).toEqual('end');
        expect(client.listenerCount('end')).toEqual(0);
    });

    it('should connect a lazy cluster and settle false once it ends', async () => {
        const client = track(clients, new Cluster([{ host: '127.0.0.1', port: 1 }], {
            lazyConnect: true,
            enableOfflineQueue: false,
            clusterRetryStrategy: () => null,
        }));
        const driver = new RedisCacheDriver({ client, prefix: '{rapiq}' });

        expect(client.status).toEqual('wait');

        const { value, elapsed } = await measure(driver.ready(5_000));

        expect(value).toEqual(false);
        expect(elapsed).toBeLessThan(1_000);
        expect(client.status).toEqual('end');
        expect(client.listenerCount('ready')).toEqual(0);
        expect(client.listenerCount('end')).toEqual(0);
    });
});

describe.skipIf(available)('src/module.ts (ready)', () => {
    it.skip(`is skipped: no Redis reachable at ${REDIS_URL} (db ${REDIS_DB})`, () => {});
});

describe.runIf(available)('src/module.ts (ready)', () => {
    const clients : RedisCacheClient[] = [];

    afterEach(async () => {
        for (const client of clients.splice(0)) {
            client.disconnect();
        }
    });

    it('should lose an invalidation issued before a fail-fast client is ready', async () => {
        const client = track(clients, new Redis(REDIS_URL, FAIL_FAST));
        const driver = new RedisCacheDriver({ client, prefix: PREFIX });

        await expect(driver.invalidate(['role'])).rejects.toThrow(/enableOfflineQueue/);
    });

    it('should let a fail-fast client invalidate once ready() resolved', async () => {
        const client = track(clients, new Redis(REDIS_URL, FAIL_FAST));
        const driver = new RedisCacheDriver({ client, prefix: PREFIX });

        expect(await driver.ready()).toEqual(true);
        await expect(driver.invalidate(['role'])).resolves.toBeUndefined();

        expect(client.listenerCount('ready')).toEqual(0);
        expect(client.listenerCount('end')).toEqual(0);
    });

    it('should answer true at once for a ready client and add no listener', async () => {
        const client = track(clients, new Redis(REDIS_URL, FAIL_FAST));
        const driver = new RedisCacheDriver({ client, prefix: PREFIX });

        await once(client, 'ready');

        const ready = driver.ready();

        expect(client.listenerCount('ready')).toEqual(0);
        expect(client.listenerCount('end')).toEqual(0);
        expect(await ready).toEqual(true);
    });

    it('should connect a lazy client that has not connected yet', async () => {
        const client = track(clients, new Redis(REDIS_URL, { ...FAIL_FAST, lazyConnect: true }));
        const driver = new RedisCacheDriver({ client, prefix: PREFIX });

        expect(client.status).toEqual('wait');
        expect(await driver.ready()).toEqual(true);
        expect(client.status).toEqual('ready');
        await expect(driver.invalidate(['role'])).resolves.toBeUndefined();
    });

    it('should answer true to concurrent callers and clean up after each', async () => {
        const client = track(clients, new Redis(REDIS_URL, { ...FAIL_FAST, lazyConnect: true }));
        const driver = new RedisCacheDriver({ client, prefix: PREFIX });

        const pending = Array.from({ length: 20 }, () => driver.ready());

        expect(client.listenerCount('end')).toEqual(1);

        const results = await Promise.all(pending);

        expect(results.every((result) => result === true)).toBeTruthy();
        expect(client.listenerCount('ready')).toEqual(0);
        expect(client.listenerCount('end')).toEqual(0);
    });

    it('should answer false after quit() and not reconnect', async () => {
        const client = track(clients, new Redis(REDIS_URL, FAIL_FAST));
        const driver = new RedisCacheDriver({ client, prefix: PREFIX });

        expect(await driver.ready()).toEqual(true);

        await client.quit();
        await waitForEnd(client);

        expect(await driver.ready()).toEqual(false);
        expect(client.status).toEqual('end');
    });

    it('should answer false after disconnect() and not reconnect', async () => {
        const client = track(clients, new Redis(REDIS_URL, FAIL_FAST));
        const driver = new RedisCacheDriver({ client, prefix: PREFIX });

        expect(await driver.ready()).toEqual(true);

        client.disconnect();
        await waitForEnd(client);

        expect(await driver.ready()).toEqual(false);
        expect(client.status).toEqual('end');
    });

    it('should settle false when the client is closed while waiting', async () => {
        const client = track(clients, new Redis(REDIS_URL, { ...FAIL_FAST, lazyConnect: true }));
        const driver = new RedisCacheDriver({ client, prefix: PREFIX });

        // the lazy client connects inside ready(); closing it in the same
        // tick ends it before it is ready.
        const ready = driver.ready(5_000);

        client.disconnect();

        const { value, elapsed } = await measure(ready);

        expect(value).toEqual(false);
        expect(elapsed).toBeLessThan(1_000);
        expect(client.listenerCount('end')).toEqual(0);
    });
});
