/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    SchemaRegistry,
    and,
    defineSchema,
    eq,
} from '@rapiq/core';
import {
    assertSchemaMatchesModel,
    defineSchemaRegistryWithDatamodel,
    defineSchemaWithModel,
} from '../../src';
import { datamodel } from '../data/datamodel';
import type { User } from '../data/type';

describe('src/schema/module.ts', () => {
    describe('defineSchemaWithModel', () => {
        it('should derive name, relations and schema mapping', () => {
            const schema = defineSchemaWithModel<User>(datamodel, 'User');

            expect(schema.name).toEqual('user');
            expect(schema.relations.allowed).toEqual(['realm', 'items']);
            expect(schema.mapSchema('realm')).toEqual('realm');
            expect(schema.mapSchema('items')).toEqual('item');
        });

        it('should inherit an allowed list from the model fields', () => {
            const schema = defineSchemaWithModel<User>(datamodel, 'User', { fields: { allowed: 'inherit' } });

            expect(schema.fields.allowed).toEqual([
                'id', 
                'first_name', 
                'last_name', 
                'email', 
                'age', 
                'address', 
                'realm_id',
            ]);
        });

        it('should keep an explicit allowed list untouched', () => {
            const schema = defineSchemaWithModel<User>(datamodel, 'User', { filters: { allowed: ['id', 'first_name'] } });

            expect(schema.filters.allowed).toEqual(['id', 'first_name']);
        });

        it('should allow nothing without per-parameter options', () => {
            // derivation supplies shape, not authorization.
            const schema = defineSchemaWithModel<User>(datamodel, 'User');

            expect(schema.fields.allowed).toEqual([]);
            expect(schema.filters.allowed).toEqual([]);
        });

        it('should let explicit base options win', () => {
            const schema = defineSchemaWithModel<User>(datamodel, 'User', {
                name: 'account',
                schemaMapping: { realm: 'customRealm' },
            });

            expect(schema.name).toEqual('account');
            expect(schema.mapSchema('realm')).toEqual('customRealm');
            expect(schema.mapSchema('items')).toEqual('item');
        });

        it('should fail typed for a model outside the datamodel', () => {
            expect(() => defineSchemaWithModel(datamodel, 'user')).toThrowError(
                expect.objectContaining({ code: ErrorCode.SCHEMA_UNRESOLVABLE }),
            );
        });
    });

    describe('defineSchemaRegistryWithDatamodel', () => {
        it('should register one schema per model', () => {
            const registry = defineSchemaRegistryWithDatamodel(datamodel);

            expect(registry.get('user')).toBeDefined();
            expect(registry.get('realm')).toBeDefined();
            expect(registry.get('item')).toBeDefined();
        });

        it('should apply per-model options keyed by derived name', () => {
            const registry = defineSchemaRegistryWithDatamodel(datamodel, { schemas: { user: { filters: { allowed: ['id'] } } } });

            expect(registry.get('user')?.filters.allowed).toEqual(['id']);
        });

        it('should keep a hand-written schema over the derived one', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                filters: { allowed: ['first_name'] },
            }));

            defineSchemaRegistryWithDatamodel(datamodel, { registry });

            expect(registry.get('user')?.filters.allowed).toEqual(['first_name']);
            expect(registry.get('realm')).toBeDefined();
        });

        it('should reject options for an already registered schema', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({ name: 'user' }));

            expect(() => defineSchemaRegistryWithDatamodel(datamodel, {
                registry,
                schemas: { user: { filters: { allowed: ['id'] } } },
            })).toThrowError(/already registered/);
        });

        it('should reject options that match no model', () => {
            expect(() => defineSchemaRegistryWithDatamodel(datamodel, { schemas: { unknown: {} } })).toThrowError(/does not match any model/);
        });
    });
});

describe('src/schema/assert.ts', () => {
    it('should accept a schema whose keys exist on the model', () => {
        const schema = defineSchema<User>({
            name: 'user',
            fields: { default: ['id'], allowed: ['email'] },
            filters: { allowed: ['first_name', 'realm.name'] },
            sort: { allowed: ['age'] },
            relations: { allowed: ['realm', 'items.realm'] },
        });

        expect(() => assertSchemaMatchesModel(schema, datamodel, 'User')).not.toThrow();
    });

    it('should collect every offending key', () => {
        const schema = defineSchema<any>({
            name: 'user',
            fields: { default: ['identifier'] },
            filters: { allowed: ['firstName', 'address'] },
            sort: { allowed: ['renamed.name'] },
            relations: { allowed: ['profile'] },
        });

        try {
            assertSchemaMatchesModel(schema, datamodel, 'User');
            expect.unreachable();
        } catch (error: any) {
            expect(error.code).toEqual(ErrorCode.SCHEMA_ENTITY_MISMATCH);
            expect(error.model).toEqual('User');
            expect([...error.keys].sort()).toEqual([
                'firstName', 
                'identifier', 
                'profile', 
                'renamed.name',
            ]);
        }
    });

    it('should validate a filters default condition tree', () => {
        const schema = defineSchema<any>({
            name: 'user',
            filters: {
                allowed: ['age'],
                default: and(eq('age', 18), eq('missing', 1)),
            },
        });

        expect(() => assertSchemaMatchesModel(schema, datamodel, 'User')).toThrowError(
            expect.objectContaining({ keys: ['missing'] }),
        );
    });

    it('should fail typed for a model outside the datamodel', () => {
        const schema = defineSchema<User>({ name: 'user' });

        expect(() => assertSchemaMatchesModel(schema, datamodel, 'Account')).toThrowError(
            expect.objectContaining({ code: ErrorCode.SCHEMA_UNRESOLVABLE }),
        );
    });
});
