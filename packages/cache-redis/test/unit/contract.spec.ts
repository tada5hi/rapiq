/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type Redis from 'ioredis';
import { describeCacheDriverContract } from '../../../cache/test/unit/driver/contract';
import { VirtualClockRedisCacheDriver } from '../utils/driver';
import {
    REDIS_DB, 
    REDIS_URL, 
    createRedisClient, 
    isRedisAvailable,
} from '../utils/redis';

const available = await isRedisAvailable();

if (!available) {
    // eslint-disable-next-line no-console
    console.warn(`@rapiq/cache-redis: no Redis reachable at ${REDIS_URL} (db ${REDIS_DB}), the driver contract is skipped.`);
}

describe.runIf(available)('src/module.ts (ICacheDriver contract against Redis)', () => {
    let client : Redis;

    // the factory runs in the contract's beforeEach; `advance` runs inside
    // the case that followed, so the instance it advances is the last one made.
    let current : VirtualClockRedisCacheDriver;

    beforeAll(async () => {
        client = createRedisClient();
        await client.connect();
    });

    afterAll(async () => {
        await client.quit();
    });

    describeCacheDriverContract(
        'RedisCacheDriver',
        async () => {
            await client.flushdb();

            current = new VirtualClockRedisCacheDriver({
                client,
                prefix: 'rapiq-test',
                maxTtl: 10_000,
            });

            return current;
        },
        {
            dropTag: (driver, tag) => driver.dropTag(tag),
            dropClock: (driver) => driver.dropClock(),
            advance: (ms) => current.advance(ms),
        },
    );
});

describe.skipIf(available)('src/module.ts (ICacheDriver contract against Redis)', () => {
    it.skip(`is skipped: no Redis reachable at ${REDIS_URL} (db ${REDIS_DB})`, () => {});
});
