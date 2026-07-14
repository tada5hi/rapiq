/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { 
    ErrorCode, 
    SchemaError, 
    SchemaRegistry, 
    defineSchema, 
} from '../../../src';
import { registry } from '../../data/schema';

describe('src/schema/registry/*.ts', () => {
    describe('add / get / getOrFail / drop', () => {
        it('should store and retrieve a schema by name', () => {
            const local = new SchemaRegistry();
            const schema = defineSchema({ name: 'foo' });
            local.add(schema);

            expect(local.get('foo')).toBe(schema);
            expect(local.getOrFail('foo')).toBe(schema);
        });

        it('should throw when adding a schema without a name', () => {
            const local = new SchemaRegistry();
            expect(() => local.add(defineSchema({}))).toThrow(SchemaError);

            try {
                local.add(defineSchema({}));
            } catch (e) {
                expect(e).toBeInstanceOf(SchemaError);
                expect((e as SchemaError).code).toBe(ErrorCode.SCHEMA_NAME_INVALID);
            }
        });

        it('should return undefined for an unknown name', () => {
            const local = new SchemaRegistry();
            expect(local.get('missing')).toBeUndefined();
        });

        it('should throw in getOrFail for an unknown name', () => {
            const local = new SchemaRegistry();
            expect(() => local.getOrFail('missing')).toThrow(SchemaError);

            try {
                local.getOrFail('missing');
            } catch (e) {
                expect(e).toBeInstanceOf(SchemaError);
                expect((e as SchemaError).code).toBe(ErrorCode.SCHEMA_UNRESOLVABLE);
            }
        });

        it('should return a passed Schema instance unchanged', () => {
            const local = new SchemaRegistry();
            const schema = defineSchema({ name: 'foo' });
            expect(local.get(schema)).toBe(schema);
        });

        it('should drop a registered schema', () => {
            const local = new SchemaRegistry();
            local.add(defineSchema({ name: 'foo' }));
            local.drop('foo');
            expect(local.get('foo')).toBeUndefined();
        });
    });

    describe('resolve', () => {
        it('should resolve a single registered name', () => {
            expect(registry.resolve('user')?.name).toBe('user');
        });

        it('should resolve a dotted path honoring schemaMapping', () => {
            // user.schemaMapping maps the `items` relation to the `item` schema.
            expect(registry.resolve('user.items')?.name).toBe('item');
        });

        it('should treat separate arguments like dotted segments', () => {
            expect(registry.resolve('user', 'items')?.name).toBe('item');
        });

        it('should resolve a relation without a schema mapping by its own name', () => {
            expect(registry.resolve('user.realm')?.name).toBe('realm');
        });

        it('should return undefined for an unknown root', () => {
            expect(registry.resolve('does-not-exist')).toBeUndefined();
        });

        it('should return undefined for an unknown relation segment', () => {
            expect(registry.resolve('user.unknown-relation')).toBeUndefined();
        });
    });
});
