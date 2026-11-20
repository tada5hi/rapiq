/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode } from '@rapiq/core';
import type { CacheEntry, ICacheDriver } from '../../src';
import {
    CacheError,
    MemoryCacheDriver,
    TaggedCache,
    isCacheError,
} from '../../src';

/**
 * A memory driver whose read path can be told to fail, recording every
 * write verdict so a spec can see a refused store.
 */
class RecordingCacheDriver implements ICacheDriver {
    protected inner : MemoryCacheDriver;

    writes : boolean[] = [];

    failOn : Set<'clock' | 'read' | 'write' | 'invalidate' | 'drop'> = new Set();

    constructor() {
        this.inner = new MemoryCacheDriver({ maxTtl: 10_000 });
    }

    get maxTtl() {
        return this.inner.maxTtl;
    }

    protected assertAvailable(step: 'clock' | 'read' | 'write' | 'invalidate' | 'drop') {
        if (this.failOn.has(step)) {
            throw new Error(`${step} unavailable`);
        }
    }

    clock() {
        this.assertAvailable('clock');

        return this.inner.clock();
    }

    read<T>(key: string) {
        this.assertAvailable('read');

        return this.inner.read<T>(key);
    }

    async write<T>(key: string, entry: CacheEntry<T>, ttl: number) {
        this.assertAvailable('write');

        const accepted = await this.inner.write(key, entry, ttl);

        this.writes.push(accepted);

        return accepted;
    }

    invalidate(tags: string[]) {
        this.assertAvailable('invalidate');

        return this.inner.invalidate(tags);
    }

    drop(keys: string[]) {
        this.assertAvailable('drop');

        return this.inner.drop(keys);
    }
}

describe('src/module.ts', () => {
    let driver : RecordingCacheDriver;

    let cache : TaggedCache;

    let errors : unknown[];

    beforeEach(() => {
        driver = new RecordingCacheDriver();
        errors = [];
        cache = new TaggedCache({
            driver,
            onError: (e) => {
                errors.push(e);
            },
        });
    });

    it('should read through on a miss and serve the hit afterwards', async () => {
        let reads = 0;
        const read = async () => {
            reads++;

            return { id: 1, name: 'admin' };
        };
        const tags = (value: { id: number }) => ['role', `role:${value.id}`];

        expect(await cache.remember('k', read, { tags })).toEqual({ id: 1, name: 'admin' });
        expect(await cache.remember('k', read, { tags })).toEqual({ id: 1, name: 'admin' });

        expect(reads).toEqual(1);
        expect(driver.writes).toEqual([true]);
    });

    it('should refuse the store when a bump lands during the read (commit then store)', async () => {
        let reads = 0;
        const read = async () => {
            reads++;

            if (reads === 1) {
                // the writer commits and bumps while the reader still holds
                // the snapshot it read before the commit.
                await cache.invalidate(['role:1']);

                return { id: 1, name: 'old' };
            }

            return { id: 1, name: 'new' };
        };
        const tags = () => ['role:1'];

        expect(await cache.remember('k', read, { tags })).toEqual({ id: 1, name: 'old' });
        expect(driver.writes).toEqual([false]);

        expect(await cache.remember('k', read, { tags })).toEqual({ id: 1, name: 'new' });
        expect(driver.writes).toEqual([false, true]);
        expect(reads).toEqual(2);
    });

    it('should serve a stale entry no more once a bump lands after the store (store then commit)', async () => {
        let reads = 0;
        const read = async () => {
            reads++;

            return { id: 1, name: reads === 1 ? 'old' : 'new' };
        };
        const tags = () => ['role:1'];

        expect(await cache.remember('k', read, { tags })).toEqual({ id: 1, name: 'old' });
        expect(driver.writes).toEqual([true]);

        await cache.invalidate(['role:1']);

        expect(await cache.remember('k', read, { tags })).toEqual({ id: 1, name: 'new' });
        expect(reads).toEqual(2);
    });

    it.each(['clock', 'read', 'write'] as const)('should fall through to the read when the driver fails on %s', async (step) => {
        driver.failOn.add(step);

        let reads = 0;
        const value = await cache.remember('k', async () => {
            reads++;

            return 'from the database';
        }, { tags: () => ['role'] });

        expect(value).toEqual('from the database');
        expect(reads).toEqual(1);
        expect(errors).toHaveLength(1);
        expect((errors[0] as Error).message).toEqual(`${step} unavailable`);
    });

    it('should report a value the memory driver cannot clone and still return it', async () => {
        const value = { id: 1, render: () => 'admin' };

        expect(await cache.remember('k', async () => value, { tags: () => ['role'] })).toBe(value);

        // structuredClone refuses a function: the write fails, is reported,
        // and the next remember reads again.
        expect(errors).toHaveLength(1);
        expect((errors[0] as Error).name).toEqual('DataCloneError');
        expect(driver.writes).toEqual([]);
        expect(await driver.read('k')).toBeNull();
    });

    it('should swallow a driver failure silently when no onError is given', async () => {
        driver.failOn.add('read');

        const silent = new TaggedCache({ driver });

        expect(await silent.remember('k', async () => 'v', { tags: () => [] })).toEqual('v');
    });

    it('should reject a failed invalidate with a CacheError carrying the tags and cause', async () => {
        driver.failOn.add('invalidate');

        let error : unknown;

        try {
            await cache.invalidate(['role', 'role:1']);
        } catch (e) {
            error = e;
        }

        expect(isCacheError(error)).toBeTruthy();
        expect((error as CacheError).tags).toEqual(['role', 'role:1']);
        expect(((error as Error).cause as Error).message).toEqual('invalidate unavailable');
        expect(errors).toHaveLength(0);
        expect(cache.pendingInvalidations).toEqual(['role', 'role:1']);
    });

    it('should rethrow a failed drop', async () => {
        driver.failOn.add('drop');

        await expect(cache.drop(['k'])).rejects.toThrow('drop unavailable');
    });

    it('should drop an entry so the next remember reads again', async () => {
        let reads = 0;
        const read = async () => {
            reads++;

            return reads;
        };

        await cache.remember('k', read, { tags: () => [] });
        await cache.drop(['k']);

        expect(await cache.remember('k', read, { tags: () => [] })).toEqual(2);
    });

    it('should report a failing tags function and return the value unstored', async () => {
        let reads = 0;
        const options = {
            tags: () : string[] => {
                throw new Error('unresolvable');
            },
        };

        // the read succeeded, so the request is answered, never failed
        // after the database work was done.
        expect(await cache.remember('k', async () => {
            reads++;

            return 'v';
        }, options)).toEqual('v');

        expect(errors).toHaveLength(1);
        expect((errors[0] as Error).message).toEqual('unresolvable');
        expect(driver.writes).toEqual([]);
        expect(await driver.read('k')).toBeNull();

        await cache.remember('k', async () => {
            reads++;

            return 'v';
        }, options);
        expect(reads).toEqual(2);
    });

    it.each([NaN, Infinity, 0, -1, 0.5])('should refuse a default ttl of %s at construction', (ttl) => {
        let error : unknown;

        try {
            new TaggedCache({ driver, ttl }).remember('k', async () => 'v', { tags: () => [] });
        } catch (e) {
            error = e;
        }

        expect(isCacheError(error)).toBeTruthy();
        expect((error as CacheError).code).toEqual(ErrorCode.INPUT_INVALID);
        expect((error as CacheError).message).toMatch(/entry ttl/);
    });

    it.each([NaN, Infinity, 0, -1, 0.5])('should refuse a per-call ttl of %s before reading', async (ttl) => {
        let reads = 0;

        await expect(cache.remember('k', async () => {
            reads++;

            return 'v';
        }, { tags: () => ['role'], ttl })).rejects.toThrow(/entry ttl/);

        expect(reads).toEqual(0);
        expect(driver.writes).toEqual([]);
    });

    it('should tell an invalid ttl and an invalid maxTtl apart', () => {
        const ttl = CacheError.ttlInvalid(NaN);
        const maxTtl = CacheError.maxTtlInvalid(NaN);

        expect(ttl.message).not.toEqual(maxTtl.message);
        expect(ttl.message).toMatch(/entry ttl/);
        expect(maxTtl.message).toMatch(/maxTtl/);
    });

    it('should use the driver maxTtl as the default ttl and honour a per-call override', async () => {
        vi.useFakeTimers();

        const short = new TaggedCache({ driver, ttl: 1_000 });

        await short.remember('default', async () => 'v', { tags: () => ['role'] });
        await cache.remember('max', async () => 'v', { tags: () => ['role'] });
        await short.remember('override', async () => 'v', { tags: () => ['role'], ttl: 5_000 });

        vi.advanceTimersByTime(1_000);
        expect(await driver.read('default')).toBeNull();
        expect(await driver.read('override')).not.toBeNull();
        expect(await driver.read('max')).not.toBeNull();

        vi.advanceTimersByTime(4_000);
        expect(await driver.read('override')).toBeNull();
        expect(await driver.read('max')).not.toBeNull();

        vi.advanceTimersByTime(5_000);
        expect(await driver.read('max')).toBeNull();

        vi.useRealTimers();
    });
});

describe('src/module.ts (lost invalidation)', () => {
    let driver : RecordingCacheDriver;

    let cache : TaggedCache;

    let errors : unknown[];

    const counter = () => {
        let reads = 0;

        return {
            read: async () => {
                reads++;

                return reads;
            },
            get count() {
                return reads;
            },
        };
    };

    beforeEach(() => {
        vi.useFakeTimers();

        driver = new RecordingCacheDriver();
        errors = [];
        cache = new TaggedCache({
            driver,
            onError: (e) => {
                errors.push(e);
            },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should treat a hit carrying a pending tag as a miss', async () => {
        const role = counter();
        const user = counter();

        await cache.remember('k', role.read, { tags: () => ['role'] });
        await cache.remember('u', user.read, { tags: () => ['user'] });
        expect(role.count).toEqual(1);

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        expect(await cache.remember('k', role.read, { tags: () => ['role'] })).toEqual(2);
        expect(role.count).toEqual(2);

        expect(await cache.remember('u', user.read, { tags: () => ['user'] })).toEqual(1);
        expect(user.count).toEqual(1);
    });

    it('should drop a pending tag after maxTtl', async () => {
        const role = counter();

        // the entry outlives the deadline only when it is written later
        // than the failure: fail first, then fill.
        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        await vi.advanceTimersByTimeAsync(driver.maxTtl / 2);
        await cache.remember('k', role.read, { tags: () => ['role'] });
        expect(role.count).toEqual(1);

        await vi.advanceTimersByTimeAsync(driver.maxTtl / 2 + 1);
        expect(cache.pendingInvalidations).toEqual([]);

        expect(await cache.remember('k', role.read, { tags: () => ['role'] })).toEqual(1);
        expect(role.count).toEqual(1);
    });

    it('should dedupe and refresh a re-failed tag', async () => {
        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        await vi.advanceTimersByTimeAsync(driver.maxTtl / 2);
        await expect(cache.invalidate(['role', 'role'])).rejects.toThrow();
        expect(cache.pendingInvalidations).toEqual(['role']);

        // past the first deadline, short of the refreshed one.
        await vi.advanceTimersByTimeAsync(driver.maxTtl / 2 + 1);
        expect(cache.pendingInvalidations).toEqual(['role']);

        await vi.advanceTimersByTimeAsync(driver.maxTtl / 2);
        expect(cache.pendingInvalidations).toEqual([]);
    });

    it('should stop recording past the cap and distrust every hit until maxTtl after the overflow', async () => {
        cache = new TaggedCache({
            driver,
            maxPendingInvalidations: 2,
            onError: (e) => {
                errors.push(e);
            },
        });

        const user = counter();

        await cache.remember('u', user.read, { tags: () => ['user'] });

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['first', 'second', 'third'])).rejects.toThrow();

        expect(cache.pendingInvalidations).toEqual(['first', 'second']);

        const overflow = errors.find((e) => isCacheError(e) && (e as CacheError).code === ErrorCode.LIMIT_EXCEEDED);

        expect(overflow).toBeDefined();
        expect((overflow as CacheError).tags).toEqual(['third']);

        expect(await cache.remember('u', user.read, { tags: () => ['user'] })).toEqual(2);

        // still inside the window: read through again, refreshing the entry.
        await vi.advanceTimersByTimeAsync(driver.maxTtl / 2);
        expect(await cache.remember('u', user.read, { tags: () => ['user'] })).toEqual(3);

        // the window is maxTtl, measured from the overflow: past it, the hit counts.
        await vi.advanceTimersByTimeAsync(driver.maxTtl / 2);
        expect(await cache.remember('u', user.read, { tags: () => ['user'] })).toEqual(3);
        expect(user.count).toEqual(3);
    });

    it.each([NaN, Infinity, 0, -1])('should refuse a maxPendingInvalidations of %s', (value) => {
        const create = () => new TaggedCache({ driver, maxPendingInvalidations: value });

        let error : unknown;

        try {
            create();
        } catch (e) {
            error = e;
        }

        expect(isCacheError(error)).toBeTruthy();
        expect((error as CacheError).code).toEqual(ErrorCode.INPUT_INVALID);
    });
});
