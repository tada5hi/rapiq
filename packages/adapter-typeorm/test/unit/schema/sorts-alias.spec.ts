/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { DataSource } from 'typeorm';
import { defineSchemaWithEntity } from '../../../src';
import { createUnconnectedDataSource } from '../../data/factory';
import { User } from '../../data/entity/user';

describe('src/schema/module.ts', () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = await createUnconnectedDataSource();
    });

    it('should accept the canonical sorts key', () => {
        const schema = defineSchemaWithEntity(User, dataSource, { sorts: { allowed: ['id'] } });

        expect(schema.sorts.allowed).toEqual(['id']);
    });

    it('should accept the deprecated sort key', () => {
        const schema = defineSchemaWithEntity(User, dataSource, { sort: { allowed: ['id'] } });

        expect(schema.sorts.allowed).toEqual(['id']);
    });

    it('should derive an allow-list through the canonical key', () => {
        const schema = defineSchemaWithEntity(User, dataSource, { sorts: { allowed: 'inherit' } });

        expect(schema.sorts.allowed).toContain('id');
    });

    it('should reject both spellings at once', () => {
        expect(() => defineSchemaWithEntity(User, dataSource, {
            sorts: { allowed: ['id'] },
            sort: { allowed: ['id'] },
        } as any)).toThrow();
    });
});
