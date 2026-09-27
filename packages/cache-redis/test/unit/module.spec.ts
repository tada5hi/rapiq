/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type Redis from 'ioredis';
import type { CacheEntry } from '@rapiq/cache';
import { CACHE_MAX_TTL_DEFAULT } from '@rapiq/cache';
import { REDIS_CACHE_PREFIX_DEFAULT, RedisCacheDriver } from '../../src';
import {
    REDIS_DB, 
    REDIS_URL, 
    createRedisClient, 
    isRedisAvailable, 
    sleep,
} from '../utils/redis';

const available = await isRedisAvailable();

const PREFIX = 'rapiq-test';
const MAX_TTL = 10_000;

const entry = <T>(clock: number, tags: string[], value: T) : CacheEntry<T> => ({
    clock,
    tags,
    value,
});

describe.runIf(available)('src/module.ts', () => {
    let client : Redis;

    let driver : RedisCacheDriver;

    beforeAll(async () => {
        client = createRedisClient();
        await client.connect();
    });

    afterAll(async () => {
        await client.quit();
    });

    beforeEach(async () => {
        await client.flushdb();

        driver = new RedisCacheDriver({
            client, 
            prefix: PREFIX, 
            maxTtl: MAX_TTL, 
        });
    });

    it('should default the prefix and maxTtl', () => {
        const defaults = new RedisCacheDriver({ client });

        expect(defaults.prefix).toEqual(REDIS_CACHE_PREFIX_DEFAULT);
        expect(defaults.prefix).toEqual('rapiq');
        expect(defaults.maxTtl).toEqual(CACHE_MAX_TTL_DEFAULT);
    });

    describe('keys', () => {
        it('should carry the prefix on every key it writes', async () => {
            await driver.write('role?page=1', entry(0, ['role', 'role:1'], [{ id: 1 }]), 1_000);
            await driver.invalidate(['realm']);

            const keys = await client.keys('*');
            expect(keys.sort()).toEqual([
                `${PREFIX}:c`,
                `${PREFIX}:e:role?page=1`,
                `${PREFIX}:t:realm`,
                `${PREFIX}:t:role`,
                `${PREFIX}:t:role:1`,
            ]);
        });

        it('should keep two prefixes apart on one client', async () => {
            const other = new RedisCacheDriver({
                client, 
                prefix: 'other', 
                maxTtl: MAX_TTL, 
            });

            await driver.write('k', entry(0, ['role'], 'mine'), 1_000);
            await other.invalidate(['role']);

            // the bump landed in the other namespace, so this one still reads.
            expect(await driver.read('k')).not.toBeNull();
            expect(await other.read('k')).toBeNull();
            expect(await driver.clock()).toEqual(0);
            expect(await other.clock()).toEqual(1);
        });

        it('should work under a hash-tagged prefix', async () => {
            const tagged = new RedisCacheDriver({
                client, 
                prefix: '{rapiq}', 
                maxTtl: MAX_TTL, 
            });

            expect(await tagged.write('k', entry(0, ['role'], { id: 1 }), 1_000)).toBeTruthy();
            expect(await tagged.read('k')).toEqual(entry(0, ['role'], { id: 1 }));
            expect(await client.exists('{rapiq}:e:k', '{rapiq}:t:role', '{rapiq}:c')).toEqual(3);
        });
    });

    describe('expiry', () => {
        it('should give the tag keys a PEXPIRE of maxTtl on write', async () => {
            await driver.write('k', entry(0, ['role', 'role:1'], 'v'), 1_000);

            for (const tag of ['role', 'role:1']) {
                const ttl = await client.pttl(`${PREFIX}:t:${tag}`);
                expect(ttl).toBeGreaterThan(MAX_TTL - 1_000);
                expect(ttl).toBeLessThanOrEqual(MAX_TTL);
            }
        });

        it('should re-arm a tag key on every write, a refused one included', async () => {
            await driver.invalidate(['role:1']);
            await client.pexpire(`${PREFIX}:t:role:1`, 100);
            await client.set(`${PREFIX}:t:role`, '0', 'PX', 100);

            // role:1 sits at version 1, so an entry read at clock 0 is refused.
            expect(await driver.write('k', entry(0, ['role', 'role:1'], 'v'), 1_000)).toBeFalsy();
            expect(await client.exists(`${PREFIX}:e:k`)).toEqual(0);

            for (const tag of ['role', 'role:1']) {
                expect(await client.pttl(`${PREFIX}:t:${tag}`)).toBeGreaterThan(MAX_TTL - 1_000);
            }
        });

        it('should give the tag keys a PEXPIRE of maxTtl on invalidate', async () => {
            await driver.invalidate(['role', 'realm']);

            for (const tag of ['role', 'realm']) {
                expect(await client.pttl(`${PREFIX}:t:${tag}`)).toBeGreaterThan(MAX_TTL - 1_000);
            }

            // the clock outlives every tag and never expires.
            expect(await client.pttl(`${PREFIX}:c`)).toEqual(-1);
        });

        it('should store the entry with its ttl, clamped to maxTtl', async () => {
            await driver.write('short', entry(0, ['role'], 'v'), 1_000);
            await driver.write('long', entry(0, ['role'], 'v'), MAX_TTL * 10);

            const short = await client.pttl(`${PREFIX}:e:short`);
            expect(short).toBeGreaterThan(0);
            expect(short).toBeLessThanOrEqual(1_000);

            const long = await client.pttl(`${PREFIX}:e:long`);
            expect(long).toBeGreaterThan(MAX_TTL - 1_000);
            expect(long).toBeLessThanOrEqual(MAX_TTL);
        });

        it('should let the server expire an entry', async () => {
            await driver.write('k', entry(0, ['role'], 'v'), 100);
            expect(await driver.read('k')).not.toBeNull();

            await sleep(400);
            expect(await driver.read('k')).toBeNull();
        });
    });

    describe('invalidate', () => {
        it('should hand every concurrent invalidate its own clock tick and never leave a tag below it', async () => {
            const second = createRedisClient();
            await second.connect();
            const other = new RedisCacheDriver({
                client: second, 
                prefix: PREFIX, 
                maxTtl: MAX_TTL, 
            });

            try {
                const calls : Promise<void>[] = [];
                for (let i = 0; i < 40; i++) {
                    const target = i % 2 === 0 ? driver : other;
                    calls.push(target.invalidate(['shared', `only:${i}`]));
                }
                await Promise.all(calls);

                const clock = await driver.clock();
                expect(clock).toEqual(40);

                // the tag every call bumped sits at the clock, never below it.
                expect(Number(await client.get(`${PREFIX}:t:shared`))).toEqual(clock);

                // each call moved the clock exactly once and stamped that tick
                // onto its own tag: the versions are a permutation of 1..40.
                const versions : number[] = [];
                for (let i = 0; i < 40; i++) {
                    versions.push(Number(await client.get(`${PREFIX}:t:only:${i}`)));
                }
                expect([...versions].sort((a, b) => a - b)).toEqual(
                    Array.from({ length: 40 }, (_, i) => i + 1),
                );
            } finally {
                await second.quit();
            }
        });

        it('should start the clock at 1 on a fresh store', async () => {
            await driver.invalidate(['role']);

            expect(await client.get(`${PREFIX}:c`)).toEqual('1');
            expect(await client.get(`${PREFIX}:t:role`)).toEqual('1');
        });

        it('should accept an empty tag list', async () => {
            await driver.invalidate([]);

            expect(await driver.clock()).toEqual(1);
        });
    });

    describe('values', () => {
        it('should serialize the value as JSON, so a Date comes back as a string', async () => {
            const createdAt = new Date('2026-01-02T03:04:05.006Z');
            await driver.write('k', entry(0, ['role'], { createdAt }), 1_000);

            const hit = await driver.read<{ createdAt: unknown }>('k');
            expect(hit?.value.createdAt).toEqual('2026-01-02T03:04:05.006Z');
        });

        it('should store an undefined value as null', async () => {
            await driver.write('k', entry(0, ['role'], undefined), 1_000);

            expect(await driver.read('k')).toEqual(entry(0, ['role'], null));
        });

        it('should answer null for an entry another writer left without a value', async () => {
            await client.hset(`${PREFIX}:e:k`, 'clock', '0', 'tags', '["role"]');
            await client.set(`${PREFIX}:c`, '0');

            expect(await driver.read('k')).toBeNull();
        });
    });

    describe('scripts', () => {
        it('should survive the script cache being flushed', async () => {
            await driver.write('k', entry(0, ['role'], 'v'), 1_000);
            await client.script('FLUSH');

            expect(await driver.read('k')).toEqual(entry(0, ['role'], 'v'));
            await driver.invalidate(['role']);
            expect(await driver.read('k')).toBeNull();
            expect(await driver.write('k', entry(1, ['role'], 'v'), 1_000)).toBeTruthy();
        });
    });

    describe('drop', () => {
        it('should accept an empty key list', async () => {
            await expect(driver.drop([])).resolves.toBeUndefined();
        });
    });
});

describe.skipIf(available)('src/module.ts', () => {
    it.skip(`is skipped: no Redis reachable at ${REDIS_URL} (db ${REDIS_DB})`, () => {});
});
