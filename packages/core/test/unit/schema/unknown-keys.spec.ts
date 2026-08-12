/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, SchemaError, defineSchema } from '../../../src';
import type { User } from '../../data';

describe('src/schema/module.ts', () => {
    it('should reject an unknown top-level key', () => {
        expect(() => defineSchema<User>({ nope: 1 } as any)).toThrow(SchemaError);
    });

    it('should carry the unknown-key error code', () => {
        try {
            defineSchema<User>({ nope: 1 } as any);
            expect.unreachable('defineSchema did not throw');
        } catch (e) {
            expect((e as SchemaError).code).toBe(ErrorCode.KEY_UNKNOWN);
        }
    });

    it('should suggest the canonical key for a near-miss', () => {
        try {
            defineSchema<User>({ field: { allowed: ['id'] } } as any);
            expect.unreachable('defineSchema did not throw');
        } catch (e) {
            expect((e as SchemaError).message).toContain('fields');
        }
    });

    it('should accept every known key', () => {
        expect(() => defineSchema<User>({
            name: 'user',
            throwOnFailure: true,
            strict: false,
            schemaMapping: { realm: 'realm' },
            indexes: [['id']],
            fields: { allowed: ['id'] },
            filters: { allowed: ['id'] },
            pagination: { maxLimit: 20 },
            relations: { allowed: ['realm'] },
            sort: { allowed: ['id'] },
        })).not.toThrow();
    });
});
