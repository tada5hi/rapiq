/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { MemoryCacheDriver } from '../../../src';
import { describeCacheDriverContract } from './contract';

/**
 * Reaches into the protected state so the contract can simulate an eviction
 * and a lost clock, which a Map never does on its own.
 */
class ChaosMemoryCacheDriver extends MemoryCacheDriver {
    dropTag(tag: string) {
        this.tags.delete(tag);
    }

    dropClock() {
        this.clockValue = undefined;
    }

    get size() {
        return this.entries.size;
    }

    get tagSize() {
        return this.tags.size;
    }
}

describe('src/driver/memory.ts', () => {
    describeCacheDriverContract(
        'MemoryCacheDriver',
        () => new ChaosMemoryCacheDriver({ maxTtl: 10_000 }),
        {
            dropTag: (driver, tag) => driver.dropTag(tag),
            dropClock: (driver) => driver.dropClock(),
        },
    );

    it('should default maxTtl to one minute', () => {
        expect(new MemoryCacheDriver().maxTtl).toEqual(60_000);
    });

    it('should refuse a maxTtl below one millisecond', () => {
        for (const maxTtl of [0, -1, 0.5, NaN, Infinity]) {
            expect(() => new MemoryCacheDriver({ maxTtl })).toThrow(/maxTtl/);
        }
    });

    it('should prune expired tags even while the entry map is full of live entries', async () => {
        vi.useFakeTimers();

        const driver = new ChaosMemoryCacheDriver({ maxTtl: 10_000 });

        // bumped once and never read again, like the record tag of a deleted row.
        await driver.invalidate(Array.from({ length: 40 }, (_, i) => `role:${i}`));
        expect(driver.tagSize).toEqual(40);

        // 20 entries still alive when the 40 tags lapse: a budget shared with
        // the entry scan spends itself on them and never reaches the tags.
        vi.advanceTimersByTime(5_000);
        for (let i = 0; i < 20; i++) {
            await driver.write(`k${i}`, {
                clock: await driver.clock(), 
                tags: ['live'], 
                value: i, 
            }, 10_000);
        }
        expect(driver.tagSize).toEqual(41);

        vi.advanceTimersByTime(5_000);
        await driver.write('k0', {
            clock: await driver.clock(), 
            tags: ['live'], 
            value: 0, 
        }, 10_000);

        // every lapsed tag goes, not a budget of them: only `live` remains.
        expect(driver.size).toEqual(20);
        expect(driver.tagSize).toEqual(1);

        vi.useRealTimers();
    });

    it('should keep the tag map bounded while the rows of a list churn', async () => {
        vi.useFakeTimers();

        // an append-only log paged newest first: every miss caches a page of
        // 50 ids nobody reads again, one miss per second.
        const driver = new ChaosMemoryCacheDriver({ maxTtl: 10_000 });
        let id = 0;
        for (let i = 0; i < 500; i++) {
            const tags = ['event'];
            for (let j = 0; j < 50; j++) {
                tags.push(`event:${id++}`);
            }

            await driver.write(`page:${i}`, {
                clock: await driver.clock(),
                tags,
                value: i,
            }, 10_000);

            vi.advanceTimersByTime(1_000);
        }

        // 10 pages fit into maxTtl: at most their tags are live.
        expect(driver.tagSize).toBeLessThanOrEqual(10 * 50 + 1);

        vi.useRealTimers();
    });

    it('should prune expired tags on invalidate as well', async () => {
        vi.useFakeTimers();

        // an insert-heavy table bumps fresh record tags and is never read.
        const driver = new ChaosMemoryCacheDriver({ maxTtl: 10_000 });
        for (let i = 0; i < 1_000; i++) {
            await driver.invalidate(['event', `event:${i}`, `event:actor=${i}`]);
            vi.advanceTimersByTime(100);
        }

        // 100 bumps fit into maxTtl, two fresh tags each, plus the shared one.
        expect(driver.tagSize).toBeLessThanOrEqual(100 * 2 + 1);

        vi.useRealTimers();
    });

    it('should prune expired entries opportunistically on write', async () => {
        vi.useFakeTimers();

        const driver = new ChaosMemoryCacheDriver({ maxTtl: 10_000 });
        const clock = await driver.clock();
        for (let i = 0; i < 40; i++) {
            await driver.write(`k${i}`, {
                clock, 
                tags: ['role'], 
                value: i, 
            }, 1_000);
        }
        expect(driver.size).toEqual(40);

        vi.advanceTimersByTime(1_000);

        // the prune is bounded, so one write removes at most 16 entries;
        // three more take the rest.
        await driver.write('fresh', {
            clock, 
            tags: ['role'], 
            value: 'v', 
        }, 1_000);
        expect(driver.size).toBeLessThanOrEqual(40 - 16 + 1);

        await driver.write('fresh', {
            clock, 
            tags: ['role'], 
            value: 'v', 
        }, 1_000);
        await driver.write('fresh', {
            clock, 
            tags: ['role'], 
            value: 'v', 
        }, 1_000);
        await driver.write('fresh', {
            clock, 
            tags: ['role'], 
            value: 'v', 
        }, 1_000);
        expect(driver.size).toEqual(1);

        vi.useRealTimers();
    });
});
