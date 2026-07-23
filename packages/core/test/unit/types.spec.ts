/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { expectTypeOf } from 'vitest';
import { defineSchema } from '../../src';
import type {
    FieldKeys,
    NestedKeys,
    NestedResourceKeys,
    SimpleKeys,
    SimpleResourceKeys,
    TypeFromNestedKeyPath,
} from '../../src';
import type {
    BagUserPermission, 
    Event, 
    User,
} from '../data/type';

describe('src/types.ts', () => {
    describe('SimpleKeys', () => {
        it('should keep existing non-nullable behavior', () => {
            const keys: SimpleKeys<User>[] = ['id', 'name', 'email', 'age'];

            // @ts-expect-error a relation is not a simple key
            const invalid: SimpleKeys<User>[] = ['realm'];

            expect(keys).toBeDefined();
            expect(invalid).toBeDefined();
        });

        it('should treat JSON columns as leaf keys', () => {
            const keys: SimpleKeys<Event>[] = ['id', 'data', 'meta', 'created_at'];

            // @ts-expect-error a (nullable) relation is not a simple key
            const invalid: SimpleKeys<Event>[] = ['realm'];

            expect(keys).toBeDefined();
            expect(invalid).toBeDefined();
        });
    });

    describe('SimpleResourceKeys', () => {
        it('should cover nullable & optional relations', () => {
            const keys: SimpleResourceKeys<Event>[] = ['realm', 'user', 'items'];

            // @ts-expect-error a JSON column is not a resource key
            const invalid: SimpleResourceKeys<Event>[] = ['data'];

            expect(keys).toBeDefined();
            expect(invalid).toBeDefined();
        });

        it('should keep existing non-nullable behavior', () => {
            const keys: SimpleResourceKeys<User>[] = ['realm', 'items'];

            // @ts-expect-error a scalar column is not a resource key
            const invalid: SimpleResourceKeys<User>[] = ['name'];

            expect(keys).toBeDefined();
            expect(invalid).toBeDefined();
        });
    });

    describe('FieldKeys', () => {
        it('should admit a concrete-typed json column that SimpleKeys rejects (#824)', () => {
            type Row = {
                id: string,
                name: string,
                args: { k: string }[] | null,
            };

            const keys: FieldKeys<Row>[] = ['id', 'name', 'args'];

            // @ts-expect-error a concrete-shaped json column is not a SimpleKey
            const rejected: SimpleKeys<Row>[] = ['args'];

            expect(keys).toBeDefined();
            expect(rejected).toBeDefined();
        });

        it('should union leaf columns and resource-shaped keys', () => {
            const keys: FieldKeys<Event>[] = ['id', 'data', 'meta', 'created_at', 'realm', 'user', 'items'];

            expect(keys).toBeDefined();
        });
    });

    describe('NestedKeys', () => {
        it('should traverse nullable & optional relations', () => {
            const keys: NestedKeys<Event>[] = [
                'id',
                'data',
                'meta',
                'created_at',
                'realm.id',
                'realm.name',
                'user.name',
                'user.realm.name',
                'items.name',
                'items.realm.name',
            ];

            expect(keys).toBeDefined();
        });

        it('should not recurse into JSON columns', () => {
            // @ts-expect-error a JSON column has no nested sub paths
            const invalid: NestedKeys<Event>[] = ['data.foo'];

            // @ts-expect-error an index-signature record has no nested sub paths
            const invalidTyped: NestedKeys<Event>[] = ['meta.foo'];

            expect(invalid).toBeDefined();
            expect(invalidTyped).toBeDefined();
        });
    });

    describe('SimpleResourceKeys (index-signature target, #789)', () => {
        it('should keep a relation whose target carries an index signature', () => {
            const keys: SimpleResourceKeys<BagUserPermission>[] = ['user'];

            // @ts-expect-error a scalar column is not a resource key
            const invalid: SimpleResourceKeys<BagUserPermission>[] = ['userId'];

            expect(keys).toBeDefined();
            expect(invalid).toBeDefined();
        });
    });

    describe('NestedResourceKeys', () => {
        it('should keep a relation whose target carries an index signature but not recurse into the bag (#789)', () => {
            const keys: NestedResourceKeys<BagUserPermission>[] = ['user'];

            // @ts-expect-error a bag relation target exposes no nested resource paths
            const invalid: NestedResourceKeys<BagUserPermission>[] = ['user.realm'];

            expect(keys).toBeDefined();
            expect(invalid).toBeDefined();
        });

        it('should cover nullable & optional relations (incl. nested)', () => {
            const keys: NestedResourceKeys<Event>[] = [
                'realm',
                'user',
                'user.realm',
                'user.items',
                'user.items.realm',
                'items',
                'items.realm',
            ];

            // @ts-expect-error a JSON column is not a resource key
            const invalid: NestedResourceKeys<Event>[] = ['data'];

            expect(keys).toBeDefined();
            expect(invalid).toBeDefined();
        });
    });

    describe('TypeFromNestedKeyPath', () => {
        it('should resolve value types through nullable segments', () => {
            expectTypeOf<TypeFromNestedKeyPath<Event, 'realm.name'>>().toEqualTypeOf<string>();
            expectTypeOf<TypeFromNestedKeyPath<Event, 'user.age'>>().toEqualTypeOf<number>();
            expectTypeOf<TypeFromNestedKeyPath<Event, 'items.name'>>().toEqualTypeOf<string>();
            expectTypeOf<TypeFromNestedKeyPath<Event, 'data'>>().toEqualTypeOf<Record<string, any> | null>();
        });
    });

    describe('defineSchema', () => {
        it('should accept nullable relations & JSON columns without casts', () => {
            const schema = defineSchema<Event>({
                name: 'event',
                fields: { allowed: ['id', 'data', 'meta'] },
                filters: { allowed: ['id', 'data'] },
                relations: { allowed: ['realm', 'user', 'items'] },
                sort: {
                    allowed: ['id', 'created_at'],
                    default: { created_at: 'DESC' },
                },
            });

            expect(schema.fields.allowed).toEqual(['id', 'data', 'meta']);
            expect(schema.filters.allowed).toEqual(['id', 'data']);
            expect(schema.relations.allowed).toEqual(['realm', 'user', 'items']);
        });

        it('should reject JSON columns as relations', () => {
            const schema = defineSchema<Event>({
                relations: {
                    // @ts-expect-error a JSON column is not a relation
                    allowed: ['data'],
                },
            });

            expect(schema).toBeDefined();
        });

        it('should accept a relation whose target carries an index signature (#789)', () => {
            const schema = defineSchema<BagUserPermission>({ relations: { allowed: ['user'] } });

            expect(schema.relations.allowed).toEqual(['user']);
        });
    });
});
