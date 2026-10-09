/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    ErrorCode,
    FILTER_OPERATOR_SEMANTICS,
    and,
    eq,
    gt,
    inArray,
    planCondition,
    ready,
    regex,
    setBinding,
    setBindingInitializer,
    setBindingLoader,
} from '../../../src';
import type { IBinding } from '../../../src';
import { useBinding } from '../../../src/native';

describe('src/native', () => {
    it('should mirror the operator-semantics table of the Rust core', () => {
        // FILTER_OPERATOR_SEMANTICS stays a synchronous TS constant (parsers
        // derive complement twins from it at import time); this pins it to
        // the Rust table, the single source of truth.
        expect(JSON.parse(useBinding().operatorSemantics())).toEqual(FILTER_OPERATOR_SEMANTICS);
    });

    it('should hand the caller\'s own values back in the plan', () => {
        const date = new Date('2024-01-01T00:00:00Z');
        const big = 10n;
        const pattern = /^pe/gi;

        const plan = planCondition(and(
            gt('created_at', date),
            inArray('n', [big as unknown as number, null]),
            regex('name', pattern),
        ));

        expect(plan?.kind).toBe('compound');
        const [compare, oneOf, match] = (plan as { children: any[] }).children;

        expect(compare.value).toBe(date);
        expect(oneOf.values[0]).toBe(big);
        expect(oneOf.includesNull).toBe(true);
        expect(match.pattern).toEqual({
            mode: 'regex', 
            source: '^pe', 
            flags: 'i', 
        });
        expect(match.ignoreCase).toBe(true);
    });

    it('should fail typed without a binding, then recover', () => {
        const binding = useBinding();

        setBindingLoader(() => {
            throw new Error('no addon for this platform');
        });

        try {
            expect(() => planCondition(eq('a', 1))).toThrow(AdapterError);

            try {
                planCondition(eq('a', 1));
            } catch (e) {
                expect((e as AdapterError).code).toBe(ErrorCode.BINDING_UNAVAILABLE);
                expect((e as AdapterError).message).toContain('no addon for this platform');
            }
        } finally {
            setBinding(binding as IBinding);
        }

        expect(planCondition(eq('a', 1))?.kind).toBe('compare');
    });

    it('should rebuild typed errors with their structured fields', () => {
        try {
            planCondition(regex('name', 5 as unknown as string));
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(AdapterError);
            expect((e as AdapterError).code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
            expect((e as AdapterError).feature).toBe('filters:regex:value');
        }
    });
    it('should resolve ready() on Node once the native binding loads', async () => {
        await expect(ready()).resolves.toBeUndefined();
        expect(planCondition(eq('a', 1))?.kind).toBe('compare');
    });

    it('should require ready() for an asynchronous initializer (browser path)', async () => {
        const binding = useBinding();
        let calls = 0;

        setBindingInitializer(async () => {
            calls += 1;
            return binding;
        });

        try {
            expect(() => planCondition(eq('a', 1))).toThrow(/await ready\(\)/);

            // concurrent callers share one initialization
            await Promise.all([ready(), ready()]);
            expect(calls).toBe(1);
            expect(planCondition(eq('a', 1))?.kind).toBe('compare');
        } finally {
            setBinding(binding as IBinding);
        }
    });

    it('should reject ready() typed when the initializer fails, and allow a retry', async () => {
        const binding = useBinding();
        let attempts = 0;

        setBindingInitializer(async () => {
            attempts += 1;
            if (attempts === 1) {
                throw new Error('fetch failed');
            }

            return binding;
        });

        try {
            await expect(ready()).rejects.toMatchObject({
                code: ErrorCode.BINDING_UNAVAILABLE,
                message: expect.stringContaining('fetch failed'),
            });

            await ready();
            expect(attempts).toBe(2);
        } finally {
            setBinding(binding as IBinding);
        }
    });
});
