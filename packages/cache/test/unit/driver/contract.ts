/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { CacheEntry, ICacheDriver } from '../../../src';

/**
 * Optional hooks a driver spec supplies so the contract can simulate what
 * the store does on its own: evicting a tag key, losing the clock key,
 * letting time pass. A driver spec that cannot provide one skips the cases
 * needing it. `advance` defaults to vitest's fake timers, which is what an
 * in-process driver reads its clock from; a driver over a live server that
 * keeps its own clock supplies a real wait.
 */
export type CacheDriverContractHooks<D extends ICacheDriver = ICacheDriver> = {
    dropTag?: (driver: D, tag: string) => Promise<void> | void,
    dropClock?: (driver: D) => Promise<void> | void,
    advance?: (ms: number) => Promise<void> | void,
};

/**
 * The semantics every {@link ICacheDriver} implements identically. Each
 * case answers a reviewed counter-example, so a driver failing one has a
 * concrete race or eviction scenario it gets wrong.
 */
export function describeCacheDriverContract<D extends ICacheDriver>(
    name: string,
    factory: () => Promise<D> | D,
    hooks: CacheDriverContractHooks<D> = {},
) {
    describe(`${name} (ICacheDriver contract)`, () => {
        let driver : D;

        const advance = async (ms: number) => {
            if (hooks.advance) {
                await hooks.advance(ms);
                return;
            }

            vi.advanceTimersByTime(ms);
        };

        beforeEach(async () => {
            if (!hooks.advance) {
                vi.useFakeTimers();
            }

            driver = await factory();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        const entry = <T>(clock: number, tags: string[], value: T) : CacheEntry<T> => ({
            clock,
            tags,
            value,
        });

        it('should start with a clock of 0', async () => {
            expect(await driver.clock()).toEqual(0);
        });

        it('should round trip an entry', async () => {
            const clock = await driver.clock();
            const accepted = await driver.write('k', entry(clock, ['role', 'role:1'], { id: 1 }), 1_000);
            expect(accepted).toBeTruthy();

            const hit = await driver.read<{ id: number }>('k');
            expect(hit).toEqual({
                clock, 
                tags: ['role', 'role:1'], 
                value: { id: 1 }, 
            });
        });

        it('should answer null for an unknown key', async () => {
            expect(await driver.read('missing')).toBeNull();
        });

        it('should expire an entry after its ttl', async () => {
            const clock = await driver.clock();
            await driver.write('k', entry(clock, ['role'], 'v'), 1_000);

            await advance(999);
            expect(await driver.read('k')).not.toBeNull();

            await advance(1);
            expect(await driver.read('k')).toBeNull();
        });

        it('should refuse a write when a tag was bumped between clock() and write', async () => {
            const clock = await driver.clock();
            await driver.invalidate(['role:1']);

            const accepted = await driver.write('k', entry(clock, ['role', 'role:1'], 'stale'), 1_000);
            expect(accepted).toBeFalsy();
            expect(await driver.read('k')).toBeNull();
        });

        it('should refuse a write whose clock is ahead of the store', async () => {
            const clock = await driver.clock();

            const accepted = await driver.write('k', entry(clock + 5, ['role'], 'future'), 1_000);
            expect(accepted).toBeFalsy();
            expect(await driver.read('k')).toBeNull();
        });

        it('should answer null after any carried tag was invalidated', async () => {
            const clock = await driver.clock();
            await driver.write('k', entry(clock, ['role', 'realm:1'], 'v'), 10_000);
            expect(await driver.read('k')).not.toBeNull();

            await driver.invalidate(['realm:1']);
            expect(await driver.read('k')).toBeNull();
        });

        it('should keep an entry whose tags were not invalidated', async () => {
            const clock = await driver.clock();
            await driver.write('k', entry(clock, ['role'], 'v'), 10_000);

            await driver.invalidate(['realm']);
            expect(await driver.read('k')).not.toBeNull();
        });

        it('should advance the clock on every invalidate', async () => {
            await driver.invalidate(['a']);
            await driver.invalidate(['b']);

            expect(await driver.clock()).toEqual(2);
        });

        it.skipIf(!hooks.dropTag)('should answer null after a tag key was evicted', async () => {
            const clock = await driver.clock();
            await driver.write('k', entry(clock, ['role', 'role:1'], 'v'), 10_000);

            await hooks.dropTag!(driver, 'role:1');
            expect(await driver.read('k')).toBeNull();
        });

        it.skipIf(!hooks.dropClock)('should answer null after the clock key was lost', async () => {
            await driver.invalidate(['a']);
            const clock = await driver.clock();
            await driver.write('k', entry(clock, ['role'], 'v'), 10_000);

            await hooks.dropClock!(driver);
            expect(await driver.read('k')).toBeNull();
        });

        it.skipIf(!hooks.dropClock)('should restart a lost clock at 0 and refuse an entry ahead of it', async () => {
            await driver.invalidate(['a']);
            const clock = await driver.clock();
            await hooks.dropClock!(driver);

            expect(await driver.clock()).toEqual(0);
            expect(await driver.write('k', entry(clock, ['role'], 'v'), 10_000)).toBeFalsy();
        });

        it('should leave every bumped tag at the clock after two invalidates', async () => {
            await driver.invalidate(['a']);
            await driver.invalidate(['a', 'b']);

            const clock = await driver.clock();
            expect(clock).toEqual(2);

            // a was bumped by both, b by the last: both sit at the clock, so
            // an entry read one tick before the last bump is refused and one
            // read at the clock accepted. Whether a driver keeps this under
            // interleaved callers is its own atomicity, not simulated here.
            expect(await driver.write('stale-a', entry(clock - 1, ['a'], 'v'), 10_000)).toBeFalsy();
            expect(await driver.write('stale-b', entry(clock - 1, ['b'], 'v'), 10_000)).toBeFalsy();
            expect(await driver.write('fresh', entry(clock, ['a', 'b'], 'v'), 10_000)).toBeTruthy();
            expect(await driver.read('fresh')).not.toBeNull();
        });

        it('should clamp the ttl to maxTtl', async () => {
            const clock = await driver.clock();
            await driver.write('long', entry(clock, ['role'], 'v'), driver.maxTtl * 10);

            await advance(driver.maxTtl - 1);
            expect(await driver.read('long')).not.toBeNull();

            // a second entry re-arms the shared tag, so the tag lapsing can
            // not stand in for the entry's own expiry: `long` has to go on
            // its clamped ttl alone while `short` still reads.
            await driver.write('short', entry(clock, ['role'], 'v'), driver.maxTtl);

            await advance(1);
            expect(await driver.read('long')).toBeNull();
            expect(await driver.read('short')).not.toBeNull();
        });

        it('should re-arm the tag keys on every write', async () => {
            const clock = await driver.clock();
            await driver.write('first', entry(clock, ['role'], 'v'), 1_000);

            await advance(driver.maxTtl - 1);
            await driver.write('second', entry(clock, ['role'], 'v'), driver.maxTtl);

            // without the re-arm the tag written with `first` lapses here and
            // `second` reads as evicted although its own ttl has not passed.
            await advance(driver.maxTtl - 1);
            expect(await driver.read('second')).not.toBeNull();
        });

        it('should round trip null and an empty array', async () => {
            const clock = await driver.clock();
            await driver.write('null', entry(clock, ['role'], null), 10_000);
            await driver.write('empty', entry(clock, ['role'], []), 10_000);

            expect(await driver.read('null')).toEqual({
                clock, 
                tags: ['role'], 
                value: null, 
            });
            expect(await driver.read('empty')).toEqual({
                clock, 
                tags: ['role'], 
                value: [], 
            });
        });

        it('should hand out a copy the caller cannot mutate the store through', async () => {
            const clock = await driver.clock();
            const value = { id: 1, nested: { name: 'a' } };
            await driver.write('k', entry(clock, ['role'], value), 10_000);
            value.nested.name = 'changed after write';

            const first = await driver.read<typeof value>('k');
            first!.value.nested.name = 'changed after read';
            first!.tags.push('injected');

            const second = await driver.read<typeof value>('k');
            expect(second).toEqual({
                clock, 
                tags: ['role'], 
                value: { id: 1, nested: { name: 'a' } }, 
            });
        });

        it('should drop entries', async () => {
            const clock = await driver.clock();
            await driver.write('a', entry(clock, ['role'], 'a'), 10_000);
            await driver.write('b', entry(clock, ['role'], 'b'), 10_000);

            await driver.drop(['a', 'unknown']);

            expect(await driver.read('a')).toBeNull();
            expect(await driver.read('b')).not.toBeNull();
        });
    });
}
