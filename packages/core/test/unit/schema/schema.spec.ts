/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FieldsSchema,
    FiltersSchema,
    PaginationSchema,
    RelationsSchema,
    SortSchema,
    defineFieldsSchema,
    defineSchema,
} from '../../../src';
import type { User } from '../../data/type';

describe('src/schema/*.ts', () => {
    describe('normalization', () => {
        it('should instantiate a sub-schema per parameter', () => {
            const schema = defineSchema<User>({});

            expect(schema.fields).toBeInstanceOf(FieldsSchema);
            expect(schema.filters).toBeInstanceOf(FiltersSchema);
            expect(schema.pagination).toBeInstanceOf(PaginationSchema);
            expect(schema.relations).toBeInstanceOf(RelationsSchema);
            expect(schema.sort).toBeInstanceOf(SortSchema);
        });

        it('should normalize plain parameter options into sub-schemas', () => {
            const schema = defineSchema<User>({
                fields: { allowed: ['id', 'name'] },
                pagination: { maxLimit: 50 },
            });

            expect(schema.fields.allowed).toEqual(['id', 'name']);
            expect(schema.fields.allowedIsUndefined).toBe(false);
            expect(schema.pagination.maxLimit).toBe(50);
        });

        it('should pass a pre-built sub-schema instance through by reference', () => {
            const fields = defineFieldsSchema<User>({ allowed: ['id'] });
            const schema = defineSchema<User>({ fields });

            expect(schema.fields).toBe(fields);
        });

        it('should derive the sort allow-list from default keys', () => {
            const schema = defineSchema<User>({ sort: { default: { name: 'DESC' } } });

            expect(schema.sort.defaultKeys).toEqual(['name']);
            expect(schema.sort.allowedIsUndefined).toBe(false);
            expect(schema.sort.allowed).toContain('name');
        });
    });

    describe('extendSchemasOptions', () => {
        it('should propagate the schema name to every sub-schema', () => {
            const schema = defineSchema<User>({ name: 'user' });

            expect(schema.fields.name).toBe('user');
            expect(schema.filters.name).toBe('user');
            expect(schema.pagination.name).toBe('user');
            expect(schema.relations.name).toBe('user');
            expect(schema.sort.name).toBe('user');
        });

        it('should propagate throwOnFailure to sub-schemas that do not set it', () => {
            const schema = defineSchema<User>({ throwOnFailure: true });

            expect(schema.fields.throwOnFailure).toBe(true);
            expect(schema.filters.throwOnFailure).toBe(true);
            expect(schema.sort.throwOnFailure).toBe(true);
        });

        it('should not override a throwOnFailure explicitly set on a sub-schema', () => {
            const fields = defineFieldsSchema<User>({ throwOnFailure: false });
            const schema = defineSchema<User>({ throwOnFailure: true, fields });

            expect(schema.fields.throwOnFailure).toBe(false);
            expect(schema.filters.throwOnFailure).toBe(true);
        });

        it('should leave throwOnFailure undefined when unset at the schema level', () => {
            const schema = defineSchema<User>({});

            expect(schema.fields.throwOnFailure).toBeUndefined();
            expect(schema.sort.throwOnFailure).toBeUndefined();
        });

        it('should propagate strict to sub-schemas that do not set it', () => {
            const schema = defineSchema<User>({ strict: true });

            expect(schema.fields.strict).toBe(true);
            expect(schema.filters.strict).toBe(true);
            expect(schema.relations.strict).toBe(true);
            expect(schema.sort.strict).toBe(true);
        });

        it('should not override a strict explicitly set on a sub-schema', () => {
            const fields = defineFieldsSchema<User>({ strict: false });
            const schema = defineSchema<User>({ strict: true, fields });

            expect(schema.fields.strict).toBe(false);
            expect(schema.filters.strict).toBe(true);
        });
    });
});
