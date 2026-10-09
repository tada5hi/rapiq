/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { BuildError, ErrorCode, defineQuery } from '../../../src';

describe('src/build/module.ts', () => {
    it('should reject an unknown top-level key', () => {
        expect(() => defineQuery({ nope: 1 } as any)).toThrow(BuildError);
    });

    it('should carry the unknown-key error code', () => {
        try {
            defineQuery({ nope: 1 } as any);
            expect.unreachable('defineQuery did not throw');
        } catch (e) {
            expect((e as BuildError).code).toBe(ErrorCode.KEY_UNKNOWN);
        }
    });

    it('should suggest the canonical key for a wire spelling', () => {
        try {
            defineQuery({ filter: { active: false } } as any);
            expect.unreachable('defineQuery did not throw');
        } catch (e) {
            expect((e as BuildError).message).toContain('filters');
        }
    });

    it('should suggest pagination for page, limit and offset', () => {
        for (const key of ['page', 'limit', 'offset']) {
            try {
                defineQuery({ [key]: 1 } as any);
                expect.unreachable(`defineQuery did not throw for ${key}`);
            } catch (e) {
                expect((e as BuildError).message).toContain('pagination');
            }
        }
    });

    it('should not suggest anything for an unrelated key', () => {
        try {
            defineQuery({ nope: 1 } as any);
            expect.unreachable('defineQuery did not throw');
        } catch (e) {
            expect((e as BuildError).message).not.toContain('Did you mean');
        }
    });

    it('should accept every known key', () => {
        expect(() => defineQuery({
            fields: ['id'],
            filters: { id: 1 },
            pagination: { limit: 1 },
            relations: ['realm'],
            sort: '-id',
        })).not.toThrow();
    });

    it('should accept an empty input', () => {
        expect(() => defineQuery()).not.toThrow();
        expect(() => defineQuery({})).not.toThrow();
    });
});
