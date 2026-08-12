/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, SchemaError, defineSchema } from '../../../src';
import type { User } from '../../data';

describe('src/schema/module.ts', () => {
    it('should accept the canonical sorts key', () => {
        const schema = defineSchema<User>({ sorts: { allowed: ['id', 'name'] } });

        expect(schema.sorts.allowed).toEqual(['id', 'name']);
    });

    it('should accept the deprecated sort key', () => {
        const schema = defineSchema<User>({ sort: { allowed: ['id', 'name'] } });

        expect(schema.sorts.allowed).toEqual(['id', 'name']);
    });

    it('should expose one instance under both property names', () => {
        const schema = defineSchema<User>({ sorts: { allowed: ['id'] } });

        expect(schema.sorts).toBe(schema.sort);
    });

    it('should share indexes through both property names', () => {
        const schema = defineSchema<User>({
            indexes: [['id']],
            sorts: { allowed: ['id'], indexed: true },
        });

        expect(schema.sort.indexes).toEqual([['id']]);
        expect(schema.sorts.indexes).toEqual([['id']]);
    });

    it('should reject both spellings at once', () => {
        expect(() => defineSchema<User>({
            sorts: { allowed: ['id'] },
            sort: { allowed: ['name'] },
        } as any)).toThrow(SchemaError);
    });

    it('should carry the ambiguous-key error code', () => {
        try {
            defineSchema<User>({ sorts: {}, sort: {} } as any);
            expect.unreachable('defineSchema did not throw');
        } catch (e) {
            expect((e as SchemaError).code).toBe(ErrorCode.KEY_AMBIGUOUS);
        }
    });

    it('should describe under both keys', () => {
        const schema = defineSchema<User>({ sorts: { allowed: ['id'] } });
        const output = schema.describe();

        expect(output.sorts).toEqual({
            allowed: ['id'],
            default: null,
            indexed: false,
        });
        expect(output.sort).toEqual(output.sorts);
    });

    it('should select the same parameter from either describe mask', () => {
        const schema = defineSchema<User>({ sorts: { allowed: ['id'] } });

        expect(schema.describe({ parameters: ['sort'] }).sorts).toBeDefined();
        expect(schema.describe({ parameters: ['sorts'] }).sorts).toBeDefined();
        expect(schema.describe({ parameters: ['fields'] }).sorts).toBeUndefined();
    });
});
