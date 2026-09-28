/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import Redis, { Cluster } from 'ioredis';
import type { CacheEntry } from '@rapiq/cache';
import { CACHE_MAX_TTL_DEFAULT, isCacheError } from '@rapiq/cache';
import { REDIS_CACHE_PREFIX_DEFAULT, RedisCacheDriver } from '../../src';
import { RedisCacheCommand } from '../../src/commands';
import type { RedisCacheScriptClient } from '../../src/types';
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

/**
 * The server time in microseconds, the unit a fresh clock is seeded in.
 */
async function serverTime(client: Redis) : Promise<number> {
    const [seconds, micros] = await client.time();
    return Number(seconds) * 1_000_000 + Number(micros);
}

describe('src/module.ts (client checks)', () => {
    it('should refuse a client that sets a keyPrefix', () => {
        const prefixed = new Redis({ lazyConnect: true, keyPrefix: 'app:' });

        try {
            let error : unknown;
            try {
                new RedisCacheDriver({ client: prefixed }).drop([]);
            } catch (e) {
                error = e;
            }

            expect(isCacheError(error)).toBeTruthy();
            expect((error as Error).message).toMatch(/keyPrefix "app:"/);
        } finally {
            prefixed.disconnect();
        }
    });

    it('should refuse a cluster prefix without a hash tag and accept one with it', () => {
        const cluster = new Cluster([{ host: '127.0.0.1', port: 7000 }], { lazyConnect: true });

        try {
            for (const prefix of [undefined, 'rapiq', '{}rapiq', 'rapiq}{', '{rapiq']) {
                expect(() => new RedisCacheDriver({ client: cluster, prefix })).toThrow(/hash tag/);
            }

            for (const prefix of ['{rapiq}', 'app:{rapiq}', '{a}b']) {
                expect(() => new RedisCacheDriver({ client: cluster, prefix })).not.toThrow();
            }
        } finally {
            cluster.disconnect();
        }
    });

    it('should accept a standalone client without a hash tag', () => {
        const standalone = new Redis({ lazyConnect: true });

        try {
            expect(() => new RedisCacheDriver({ client: standalone, prefix: 'rapiq' })).not.toThrow();
        } finally {
            standalone.disconnect();
        }
    });
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

    it('should refuse a maxTtl Redis would reject as PX 0', () => {
        for (const maxTtl of [0, 0.5, -1]) {
            expect(() => new RedisCacheDriver({ client, maxTtl })).toThrow(/maxTtl/);
        }
    });

    it('should default the prefix and maxTtl', () => {
        const defaults = new RedisCacheDriver({ client });

        expect(defaults.prefix).toEqual(REDIS_CACHE_PREFIX_DEFAULT);
        expect(defaults.prefix).toEqual('rapiq');
        expect(defaults.maxTtl).toEqual(CACHE_MAX_TTL_DEFAULT);
    });

    describe('keys', () => {
        it('should carry the prefix on every key it writes', async () => {
            const clock = await driver.clock();
            expect(await driver.write('role?page=1', entry(clock, ['role', 'role:1'], [{ id: 1 }]), 1_000)).toBeTruthy();
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

            const mine = await driver.clock();
            const theirs = await other.clock();
            await driver.write('k', entry(mine, ['role'], 'mine'), 1_000);
            await other.invalidate(['role']);

            // the bump landed in the other namespace, so this one still reads.
            expect(await driver.read('k')).not.toBeNull();
            expect(await other.read('k')).toBeNull();
            expect(await driver.clock()).toEqual(mine);
            expect(await other.clock()).toEqual(theirs + 1);
        });

        it('should work under a hash-tagged prefix', async () => {
            const tagged = new RedisCacheDriver({
                client, 
                prefix: '{rapiq}', 
                maxTtl: MAX_TTL, 
            });

            const clock = await tagged.clock();
            expect(await tagged.write('k', entry(clock, ['role'], { id: 1 }), 1_000)).toBeTruthy();
            expect(await tagged.read('k')).toEqual(entry(clock, ['role'], { id: 1 }));
            expect(await client.exists('{rapiq}:e:k', '{rapiq}:t:role', '{rapiq}:c')).toEqual(3);
        });
    });

    describe('expiry', () => {
        it('should give the tag keys a PEXPIRE of maxTtl on write', async () => {
            await driver.write('k', entry(await driver.clock(), ['role', 'role:1'], 'v'), 1_000);

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

            // role:1 sits above the clock an earlier reader observed.
            const clock = await driver.clock();
            expect(await driver.write('k', entry(clock - 1, ['role', 'role:1'], 'v'), 1_000)).toBeFalsy();
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
            const clock = await driver.clock();
            await driver.write('short', entry(clock, ['role'], 'v'), 1_000);
            await driver.write('long', entry(clock, ['role'], 'v'), MAX_TTL * 10);

            const short = await client.pttl(`${PREFIX}:e:short`);
            expect(short).toBeGreaterThan(0);
            expect(short).toBeLessThanOrEqual(1_000);

            const long = await client.pttl(`${PREFIX}:e:long`);
            expect(long).toBeGreaterThan(MAX_TTL - 1_000);
            expect(long).toBeLessThanOrEqual(MAX_TTL);
        });

        it.each([NaN, Infinity, 0, -1, 0.5])('should store an entry with ttl %s for maxTtl, never without an expiry', async (ttl) => {
            expect(await driver.write('k', entry(await driver.clock(), ['role'], 'v'), ttl)).toBeTruthy();

            const pttl = await client.pttl(`${PREFIX}:e:k`);
            expect(pttl).toBeGreaterThan(MAX_TTL - 1_000);
            expect(pttl).toBeLessThanOrEqual(MAX_TTL);
        });

        it('should refuse an invalid ttl in the script before writing anything', async () => {
            const scripts = client as unknown as RedisCacheScriptClient;

            await expect(scripts[RedisCacheCommand.WRITE]!(
                3,
                `${PREFIX}:e:k`,
                `${PREFIX}:c`,
                `${PREFIX}:t:role`,
                0,
                0,
                MAX_TTL,
                '["role"]',
                '"v"',
            )).rejects.toThrow(/invalid write arguments/);

            expect(await client.exists(`${PREFIX}:e:k`, `${PREFIX}:c`, `${PREFIX}:t:role`)).toEqual(0);
        });

        it.each([
            ['a NaN ttl', ['1', 'NaN', String(MAX_TTL)]],
            ['a fractional ttl', ['1', '1.5', String(MAX_TTL)]],
            ['an infinite ttl', ['1', 'inf', String(MAX_TTL)]],
            ['a NaN entry clock', ['NaN', '1000', String(MAX_TTL)]],
            ['a negative entry clock', ['-1', '1000', String(MAX_TTL)]],
        ])('should refuse %s in the script before writing anything', async (_, args) => {
            const scripts = client as unknown as RedisCacheScriptClient;

            await expect(scripts[RedisCacheCommand.WRITE]!(
                3,
                `${PREFIX}:e:k`,
                `${PREFIX}:c`,
                `${PREFIX}:t:role`,
                ...args,
                '["role"]',
                '"v"',
            )).rejects.toThrow(/invalid write arguments/);

            expect(await client.exists(`${PREFIX}:e:k`)).toEqual(0);
        });

        it('should refuse a tag list that is not a JSON array in the script', async () => {
            const scripts = client as unknown as RedisCacheScriptClient;

            await expect(scripts[RedisCacheCommand.WRITE]!(
                3,
                `${PREFIX}:e:k`,
                `${PREFIX}:c`,
                `${PREFIX}:t:role`,
                '1',
                '1000',
                String(MAX_TTL),
                '{"a":"role"}',
                '"v"',
            )).rejects.toThrow(/invalid write arguments/);
        });

        it('should never cache under a key that is not well-formed UTF-16', async () => {
            const clock = await driver.clock();
            expect(await driver.write('role/\ud800', entry(clock, ['role'], 'a'), 1_000)).toBe(false);
            expect(await driver.read('role/\ud800')).toBeNull();
            expect(await client.keys(`${PREFIX}:e:*`)).toEqual([]);
        });

        it('should let the server expire an entry', async () => {
            await driver.write('k', entry(await driver.clock(), ['role'], 'v'), 100);
            expect(await driver.read('k')).not.toBeNull();

            await sleep(400);
            expect(await driver.read('k')).toBeNull();
        });
    });

    describe('read', () => {
        it.each([
            ['an object tag list', {
                clock: '1', 
                tags: '{"a":"role"}', 
                value: '"v"', 
            }],
            ['a NaN entry clock', {
                clock: 'nan', 
                tags: '[]', 
                value: '"v"', 
            }],
            ['an infinite entry clock', {
                clock: '-inf', 
                tags: '[]', 
                value: '"v"', 
            }],
        ])('should refuse and delete an entry holding %s', async (_, fields) => {
            await driver.clock();
            await client.hset(`${PREFIX}:e:k`, fields);

            expect(await driver.read('k')).toBeNull();
            expect(await client.exists(`${PREFIX}:e:k`)).toEqual(0);
        });
    });

    describe('commands', () => {
        it('should register every script under a name versioned by its source', () => {
            for (const name of Object.values(RedisCacheCommand)) {
                expect(name).toMatch(/^rapiqCache[A-Za-z]+_[0-9a-f]{12}$/);
            }
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
                const start = await driver.clock();

                const calls : Promise<void>[] = [];
                for (let i = 0; i < 40; i++) {
                    const target = i % 2 === 0 ? driver : other;
                    calls.push(target.invalidate(['shared', `only:${i}`]));
                }
                await Promise.all(calls);

                const clock = await driver.clock();
                expect(clock).toEqual(start + 40);

                // the tag every call bumped sits at the clock, never below it.
                expect(Number(await client.get(`${PREFIX}:t:shared`))).toEqual(clock);

                // each call moved the clock exactly once and stamped that tick
                // onto its own tag: the versions are a permutation of the 40
                // ticks after the start.
                const versions : number[] = [];
                for (let i = 0; i < 40; i++) {
                    versions.push(Number(await client.get(`${PREFIX}:t:only:${i}`)));
                }
                expect([...versions].sort((a, b) => a - b)).toEqual(
                    Array.from({ length: 40 }, (_, i) => start + i + 1),
                );
            } finally {
                await second.quit();
            }
        });

        it('should seed a fresh clock one tick past the server time', async () => {
            const before = await serverTime(client);
            await driver.invalidate(['role']);
            const after = await serverTime(client);

            const clock = await client.get(`${PREFIX}:c`);
            expect(clock).toMatch(/^\d+$/);
            expect(Number(clock)).toBeGreaterThan(before);
            expect(Number(clock)).toBeLessThanOrEqual(after + 1);
            expect(await client.get(`${PREFIX}:t:role`)).toEqual(clock);
        });

        it('should accept an empty tag list', async () => {
            const start = await driver.clock();
            await driver.invalidate([]);

            expect(await driver.clock()).toEqual(start + 1);
        });
    });

    describe('values', () => {
        it('should serialize the value as JSON, so a Date comes back as a string', async () => {
            const createdAt = new Date('2026-01-02T03:04:05.006Z');
            await driver.write('k', entry(await driver.clock(), ['role'], { createdAt }), 1_000);

            const hit = await driver.read<{ createdAt: unknown }>('k');
            expect(hit?.value.createdAt).toEqual('2026-01-02T03:04:05.006Z');
        });

        it('should store an undefined value as null', async () => {
            const clock = await driver.clock();
            await driver.write('k', entry(clock, ['role'], undefined), 1_000);

            expect(await driver.read('k')).toEqual(entry(clock, ['role'], null));
        });

        it('should answer null for an entry another writer left without a value', async () => {
            await client.hset(`${PREFIX}:e:k`, 'clock', '0', 'tags', '["role"]');
            await client.set(`${PREFIX}:c`, '0');

            expect(await driver.read('k')).toBeNull();
        });
    });

    describe('scripts', () => {
        it('should survive the script cache being flushed', async () => {
            const clock = await driver.clock();
            await driver.write('k', entry(clock, ['role'], 'v'), 1_000);
            await client.script('FLUSH');

            expect(await driver.read('k')).toEqual(entry(clock, ['role'], 'v'));
            await driver.invalidate(['role']);
            expect(await driver.read('k')).toBeNull();
            expect(await driver.write('k', entry(clock + 1, ['role'], 'v'), 1_000)).toBeTruthy();
        });
    });

    describe('clock', () => {
        it('should seed a fresh clock from the server time in microseconds', async () => {
            const before = await serverTime(client);
            const clock = await driver.clock();
            const after = await serverTime(client);

            expect(clock).toBeGreaterThanOrEqual(before);
            expect(clock).toBeLessThanOrEqual(after);
            // stored as a plain integer string, never in exponent notation.
            expect(await client.get(`${PREFIX}:c`)).toEqual(`${clock}`);
            expect(await driver.clock()).toEqual(clock);
        });

        it('should seed a clock a write finds absent', async () => {
            const before = await serverTime(client);
            await driver.write('k', entry(0, ['role'], 'v'), 1_000);

            expect(Number(await client.get(`${PREFIX}:c`))).toBeGreaterThanOrEqual(before);
        });

        it('should restart a lost clock above everything the lost one issued', async () => {
            const clock = await driver.clock();
            expect(await driver.write('k', entry(clock, ['role', 'role:1'], 'old'), 10_000)).toBeTruthy();
            await driver.invalidate(['realm']);
            const lost = await driver.clock();

            await client.del(`${PREFIX}:c`);
            await driver.invalidate(['role', 'role:1']);

            // the bump after the loss lands above the pre-loss entry, so it
            // stays dead however far the restarted counter climbs.
            expect(await driver.clock()).toBeGreaterThan(lost);
            expect(Number(await client.get(`${PREFIX}:t:role:1`))).toBeGreaterThan(clock);
            await driver.invalidate(['x']);
            await driver.invalidate(['y']);
            expect(await driver.read('k')).toBeNull();
        });

        it('should accept fills carrying a tag left high by a lost clock', async () => {
            // a tag bumped often before the clock key was lost.
            await client.set(`${PREFIX}:t:realm`, '500', 'PX', MAX_TTL);

            const clock = await driver.clock();
            expect(await driver.write('k', entry(clock, ['realm'], 'v'), 1_000)).toBeTruthy();
            expect(await driver.read('k')).not.toBeNull();
        });

        it('should delete an entry it reads while the clock is absent', async () => {
            await driver.write('k', entry(await driver.clock(), ['role'], 'v'), 1_000);
            await client.del(`${PREFIX}:c`);

            expect(await driver.read('k')).toBeNull();
            expect(await client.exists(`${PREFIX}:e:k`)).toEqual(0);
        });

        it('should delete an entry whose clock is ahead of the store', async () => {
            const clock = await driver.clock();
            await client.hset(`${PREFIX}:e:k`, 'clock', `${clock + 100}`, 'tags', '["role"]', 'value', '"v"');

            expect(await driver.read('k')).toBeNull();
            expect(await client.exists(`${PREFIX}:e:k`)).toEqual(0);
        });
    });

    describe('tags', () => {
        it.each(['not json', '["role:name=\\ud800"]', '{"a":1', '[["role"]]'])('should delete an entry whose tag list does not decode to tags (%s)', async (tags) => {
            const clock = await driver.clock();
            await client.hset(`${PREFIX}:e:k`, 'clock', `${clock}`, 'tags', tags, 'value', '"v"');

            expect(await driver.read('k')).toBeNull();
            expect(await client.exists(`${PREFIX}:e:k`)).toEqual(0);
        });

        it('should refuse a lone surrogate tag without touching the store', async () => {
            const clock = await driver.clock();

            expect(await driver.write('k', entry(clock, ['role:name=\ud800'], 'v'), 1_000)).toBeFalsy();
            expect(await client.keys(`${PREFIX}:[et]:*`)).toEqual([]);
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
