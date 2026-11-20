/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode } from '@rapiq/core';
import type { CacheEntry, ICacheDriver } from '../../src';
import { REPLAY_DELAY_MAX } from '../../src/constants';
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

    constructor(maxTtl = 10_000) {
        this.inner = new MemoryCacheDriver({ maxTtl });
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

    /**
     * Every attempted invalidate, in order, whether it succeeded or not.
     */
    invalidations : string[][] = [];

    /**
     * Held by the next invalidate before it decides, then released.
     */
    gate : Promise<void> | undefined;

    async invalidate(tags: string[]) {
        this.invalidations.push([...tags]);

        if (this.gate) {
            const { gate } = this;

            this.gate = undefined;

            await gate;
        }

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

        cache.dispose();
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

    /**
     * Move the wall clock past any backoff window without firing a timer
     * (fake timers keep their remaining delay across a system time jump).
     */
    const leaveBackoffWindow = () => {
        vi.setSystemTime(Date.now() + 5_000);
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
        cache.dispose();

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

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        // the deadline is maxTtl plus the margin for a write in flight.
        await vi.advanceTimersByTimeAsync(driver.maxTtl + REPLAY_DELAY_MAX - 1);
        expect(cache.pendingInvalidations).toEqual(['role']);

        await vi.advanceTimersByTimeAsync(1);
        expect(cache.pendingInvalidations).toEqual([]);

        // past the deadline a fill is stored and served again.
        expect(await cache.remember('k', role.read, { tags: () => ['role'] })).toEqual(1);
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
        await vi.advanceTimersByTimeAsync(driver.maxTtl / 2 + REPLAY_DELAY_MAX + 1);
        expect(cache.pendingInvalidations).toEqual(['role']);

        await vi.advanceTimersByTimeAsync(driver.maxTtl / 2);
        expect(cache.pendingInvalidations).toEqual([]);
    });

    it('should stop recording past the cap and distrust every hit until maxTtl after the overflow', async () => {
        cache.dispose();
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

        // the window is maxTtl plus the in-flight margin, from the overflow.
        await vi.advanceTimersByTimeAsync(driver.maxTtl + REPLAY_DELAY_MAX - 1);
        expect(await cache.remember('u', user.read, { tags: () => ['user'] })).toEqual(3);

        // past it, a fill is stored and its hit counts again.
        await vi.advanceTimersByTimeAsync(1);
        expect(await cache.remember('u', user.read, { tags: () => ['user'] })).toEqual(4);
        expect(await cache.remember('u', user.read, { tags: () => ['user'] })).toEqual(4);
        expect(user.count).toEqual(4);
    });

    it('should not store a fill carrying a pending tag', async () => {
        const role = counter();

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        // the fill may have read before the failed write committed: it is
        // answered, never stored, and nothing is reported.
        expect(await cache.remember('k', role.read, { tags: () => ['role', 'user'] })).toEqual(1);
        expect(await cache.remember('k', role.read, { tags: () => ['role', 'user'] })).toEqual(2);
        expect(driver.writes).toEqual([]);
        expect(await driver.read('k')).toBeNull();
        expect(errors.filter((e) => !isCacheError(e) || (e as CacheError).tags.length === 0)).toEqual([]);

        driver.failOn.delete('invalidate');
        await vi.advanceTimersByTimeAsync(5_000);
        expect(cache.pendingInvalidations).toEqual([]);

        expect(await cache.remember('k', role.read, { tags: () => ['role', 'user'] })).toEqual(3);
        expect(driver.writes).toEqual([true]);
        expect(await cache.remember('k', role.read, { tags: () => ['role', 'user'] })).toEqual(3);
    });

    it('should not replay opportunistically within the backoff window', async () => {
        const user = counter();

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        // read keeps working, invalidate keeps failing.
        for (let i = 0; i < 5; i++) {
            await cache.remember('u', user.read, { tags: () => ['user'] });
        }

        await vi.advanceTimersByTimeAsync(50);

        for (let i = 0; i < 5; i++) {
            await cache.remember('u', user.read, { tags: () => ['user'] });
        }

        await vi.advanceTimersByTimeAsync(0);
        expect(driver.invalidations).toHaveLength(1);
        expect(errors).toHaveLength(0);

        // the timer attempt at 100 ms fails and opens a 200 ms window.
        await vi.advanceTimersByTimeAsync(50);
        expect(driver.invalidations).toHaveLength(2);
        expect(errors).toHaveLength(1);

        for (let i = 0; i < 5; i++) {
            await cache.remember('u', user.read, { tags: () => ['user'] });
        }

        await vi.advanceTimersByTimeAsync(199);

        for (let i = 0; i < 5; i++) {
            await cache.remember('u', user.read, { tags: () => ['user'] });
        }

        await vi.advanceTimersByTimeAsync(0);
        expect(driver.invalidations).toHaveLength(2);
        expect(errors).toHaveLength(1);

        // past the window, a successful driver call may try again.
        await vi.advanceTimersByTimeAsync(1);
        expect(driver.invalidations).toHaveLength(3);
    });

    it('should not store a fill during the overflow window', async () => {
        cache.dispose();
        cache = new TaggedCache({ driver, maxPendingInvalidations: 1 });

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['first', 'second'])).rejects.toThrow();

        // 'second' was dropped: a fill tagged with it (or with anything)
        // may hold what its lost bump was meant to retire.
        const user = counter();

        expect(await cache.remember('u', user.read, { tags: () => ['second'] })).toEqual(1);
        expect(await cache.remember('u', user.read, { tags: () => ['second'] })).toEqual(2);
        expect(driver.writes).toEqual([]);
        expect(await driver.read('u')).toBeNull();
    });

    it('should keep replaying the stored tags after an overflow', async () => {
        cache.dispose();
        cache = new TaggedCache({ driver, maxPendingInvalidations: 1 });

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['first', 'second'])).rejects.toThrow();
        expect(cache.pendingInvalidations).toEqual(['first']);

        driver.failOn.delete('invalidate');
        await vi.advanceTimersByTimeAsync(100);

        expect(driver.invalidations.at(-1)).toEqual(['first']);
        expect(cache.pendingInvalidations).toEqual([]);
    });

    it('should replay on a timer with backoff until it succeeds', async () => {
        const role = counter();

        await cache.remember('k', role.read, { tags: () => ['role'] });

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();
        expect(driver.invalidations).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(99);
        expect(driver.invalidations).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(driver.invalidations).toHaveLength(2);

        await vi.advanceTimersByTimeAsync(199);
        expect(driver.invalidations).toHaveLength(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(driver.invalidations).toHaveLength(3);

        const failures = errors.filter((e) => isCacheError(e));

        expect(failures).toHaveLength(2);
        expect((failures[0] as CacheError).tags).toEqual(['role']);
        expect(((failures[0] as Error).cause as Error).message).toEqual('invalidate unavailable');

        driver.failOn.delete('invalidate');
        await vi.advanceTimersByTimeAsync(400);
        expect(driver.invalidations).toHaveLength(4);
        expect(driver.invalidations[3]).toEqual(['role']);
        expect(cache.pendingInvalidations).toEqual([]);
        expect(vi.getTimerCount()).toEqual(0);

        // the bump landed: the entry written before the failure is stale
        // for the driver itself, not only for this process.
        expect(await driver.read('k')).toBeNull();

        expect(await cache.remember('k', role.read, { tags: () => ['role'] })).toEqual(2);
        expect(await cache.remember('k', role.read, { tags: () => ['role'] })).toEqual(2);
        expect(role.count).toEqual(2);
    });

    it('should cap the backoff and reset it once the set empties', async () => {
        // a deadline beyond the capped attempt.
        cache.dispose();
        driver = new RecordingCacheDriver(60_000);
        cache = new TaggedCache({ driver });

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        // 100 + 200 + 400 + 800 + 1600 + 3200 = 6300, then 5000 steps.
        await vi.advanceTimersByTimeAsync(6300);
        expect(driver.invalidations).toHaveLength(7);
        await vi.advanceTimersByTimeAsync(4999);
        expect(driver.invalidations).toHaveLength(7);
        await vi.advanceTimersByTimeAsync(1);
        expect(driver.invalidations).toHaveLength(8);

        driver.failOn.delete('invalidate');
        await vi.advanceTimersByTimeAsync(5000);
        expect(cache.pendingInvalidations).toEqual([]);

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['user'])).rejects.toThrow();

        const before = driver.invalidations.length;

        await vi.advanceTimersByTimeAsync(100);
        expect(driver.invalidations).toHaveLength(before + 1);
    });

    it('should replay opportunistically after a successful driver call', async () => {
        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        driver.failOn.delete('invalidate');
        leaveBackoffWindow();
        await cache.remember('x', async () => 'v', { tags: () => ['user'] });
        await vi.advanceTimersByTimeAsync(0);

        expect(driver.invalidations).toEqual([['role'], ['role']]);
        expect(cache.pendingInvalidations).toEqual([]);
    });

    it('should replay opportunistically after a drop', async () => {
        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        driver.failOn.delete('invalidate');
        leaveBackoffWindow();
        await cache.drop(['x']);
        await vi.advanceTimersByTimeAsync(0);

        expect(cache.pendingInvalidations).toEqual([]);
    });

    it('should carry pending tags on the next invalidate', async () => {
        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['a'])).rejects.toThrow();

        driver.failOn.delete('invalidate');
        await cache.invalidate(['b']);

        expect(driver.invalidations).toEqual([['a'], ['b', 'a']]);
        expect(cache.pendingInvalidations).toEqual([]);
    });

    it('should keep its own and the older pending tags when the next invalidate fails', async () => {
        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['a'])).rejects.toThrow();

        let error : unknown;

        try {
            await cache.invalidate(['b']);
        } catch (e) {
            error = e;
        }

        expect((error as CacheError).tags).toEqual(['b']);
        expect(driver.invalidations).toEqual([['a'], ['b', 'a']]);
        expect(cache.pendingInvalidations).toEqual(['a', 'b']);
    });

    it('should keep a tag re-failed during an in-flight replay', async () => {
        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['a'])).rejects.toThrow();

        // the replay is held after it was sent and will succeed.
        const { promise, resolve: release } = Promise.withResolvers<void>();

        driver.gate = promise;
        driver.failOn.delete('invalidate');

        await vi.advanceTimersByTimeAsync(100);
        expect(driver.invalidations).toEqual([['a'], ['a']]);

        // a later write's bump of the same tag fails while it is held: the
        // held bump may have landed before that write committed.
        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['a'])).rejects.toThrow();
        driver.failOn.delete('invalidate');

        release();
        await vi.advanceTimersByTimeAsync(0);

        expect(cache.pendingInvalidations).toEqual(['a']);

        await vi.advanceTimersByTimeAsync(5000);
        expect(cache.pendingInvalidations).toEqual([]);
    });

    it('should share one replay between concurrent triggers', async () => {
        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['a'])).rejects.toThrow();

        const { promise, resolve: release } = Promise.withResolvers<void>();

        driver.gate = promise;
        driver.failOn.delete('invalidate');
        leaveBackoffWindow();

        await cache.drop(['x']);
        await cache.drop(['y']);
        await vi.advanceTimersByTimeAsync(100);

        expect(driver.invalidations).toEqual([['a'], ['a']]);

        release();
        await vi.advanceTimersByTimeAsync(0);
        expect(cache.pendingInvalidations).toEqual([]);
    });

    it('should report a failed replay to onError and never reject unhandled', async () => {
        const reported : unknown[] = [];

        cache.dispose();
        cache = new TaggedCache({
            driver,
            onError: (e) => {
                reported.push(e);

                throw new Error('the hook failed too');
            },
        });

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        // timer path
        await vi.advanceTimersByTimeAsync(100);
        // opportunistic path
        leaveBackoffWindow();
        await cache.drop(['x']);
        await vi.advanceTimersByTimeAsync(0);

        expect(reported).toHaveLength(2);

        for (const error of reported) {
            expect(isCacheError(error)).toBeTruthy();
            expect((error as CacheError).tags).toEqual(['role']);
        }
    });

    it('should stop replaying once every tag passed its deadline', async () => {
        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();

        await vi.advanceTimersByTimeAsync(driver.maxTtl + 10_000);

        expect(cache.pendingInvalidations).toEqual([]);
        expect(vi.getTimerCount()).toEqual(0);

        const attempts = driver.invalidations.length;

        await vi.advanceTimersByTimeAsync(60_000);
        expect(driver.invalidations).toHaveLength(attempts);
    });

    it('should stop the timer on dispose', async () => {
        const role = counter();

        await cache.remember('k', role.read, { tags: () => ['role'] });

        driver.failOn.add('invalidate');
        await expect(cache.invalidate(['role'])).rejects.toThrow();
        expect(vi.getTimerCount()).toEqual(1);

        cache.dispose();
        expect(vi.getTimerCount()).toEqual(0);

        // failures still record and still bypass, but never schedule.
        await expect(cache.invalidate(['user'])).rejects.toThrow();
        expect(vi.getTimerCount()).toEqual(0);
        expect(cache.pendingInvalidations).toEqual(['role', 'user']);
        expect(await cache.remember('k', role.read, { tags: () => ['role'] })).toEqual(2);
        expect(vi.getTimerCount()).toEqual(0);

        // the opportunistic replay still runs, once out of the backoff window.
        driver.failOn.delete('invalidate');
        leaveBackoffWindow();
        await cache.drop(['x']);
        await vi.advanceTimersByTimeAsync(0);
        expect(cache.pendingInvalidations).toEqual([]);
    });

    it('should keep the tags through a JSON round trip', () => {
        const failed = CacheError.invalidationFailed(['role', 'role:1'], new Error('down'));
        const json = JSON.parse(JSON.stringify(failed));

        expect(json.tags).toEqual(['role', 'role:1']);
        expect(isCacheError(json)).toBeTruthy();

        const plain = JSON.parse(JSON.stringify(CacheError.ttlInvalid(0)));

        expect(plain.tags).toBeUndefined();
        expect(isCacheError(plain)).toBeTruthy();
    });

    it.each([NaN, Infinity, 0, -1, 1.5])('should refuse a maxPendingInvalidations of %s', (value) => {
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
