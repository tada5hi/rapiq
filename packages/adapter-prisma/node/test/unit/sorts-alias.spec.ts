/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, SchemaError } from '@rapiq/core';
import { defineSchemaWithModel } from '../../src';
import { datamodel } from '../data/datamodel';
import type { User } from '../data/type';

describe('src/schema/module.ts', () => {
    it('should accept the canonical sorts key', () => {
        const schema = defineSchemaWithModel<User>(datamodel, 'User', { sorts: { allowed: ['id'] } });

        expect(schema.sorts.allowed).toEqual(['id']);
    });

    it('should accept the deprecated sort key', () => {
        const schema = defineSchemaWithModel<User>(datamodel, 'User', { sort: { allowed: ['id'] } });

        expect(schema.sorts.allowed).toEqual(['id']);
    });

    it('should derive an allow-list through the canonical key', () => {
        const schema = defineSchemaWithModel<User>(datamodel, 'User', { sorts: { allowed: 'inherit' } });

        expect(schema.sorts.allowed).toContain('id');
    });

    it('should reject both spellings at once', () => {
        expect(() => defineSchemaWithModel<User>(datamodel, 'User', {
            sorts: { allowed: ['id'] },
            sort: { allowed: ['id'] },
        } as any)).toThrowError(
            expect.objectContaining({ code: ErrorCode.KEY_AMBIGUOUS }),
        );

        expect(() => defineSchemaWithModel<User>(datamodel, 'User', {
            sorts: { allowed: ['id'] },
            sort: { allowed: ['id'] },
        } as any)).toThrow(SchemaError);
    });
});
