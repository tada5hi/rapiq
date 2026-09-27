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
