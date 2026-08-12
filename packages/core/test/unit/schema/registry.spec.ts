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

        it('should register a schema under an explicitly passed name', () => {
            const local = new SchemaRegistry();
            const schema = defineSchema({});

            local.add('foo', schema);

            expect(local.get('foo')).toBe(schema);
        });

        it('should adopt the explicitly passed name on the schema itself', () => {
            const local = new SchemaRegistry();
            const schema = defineSchema({});

            local.add('foo', schema);

            expect(schema.name).toBe('foo');
            expect(schema.fields.name).toBe('foo');
        });

        it('should let an explicitly passed name replace the declared one', () => {
            const local = new SchemaRegistry();
            const schema = defineSchema({ name: 'declared' });

            local.add('explicit', schema);

            expect(local.get('explicit')).toBe(schema);
            expect(local.get('declared')).toBeUndefined();
            expect(schema.name).toBe('explicit');
        });
    });

    describe('getAll', () => {
        it('should return an empty array for an empty registry', () => {
            const local = new SchemaRegistry();
            expect(local.getAll()).toEqual([]);
        });

        it('should return every registered schema in registration order', () => {
            const local = new SchemaRegistry();
            const foo = defineSchema({ name: 'foo' });
            const bar = defineSchema({ name: 'bar' });
            const baz = defineSchema({ name: 'baz' });

            local.add(foo);
            local.add(bar);
            local.add(baz);

            expect(local.getAll()).toEqual([foo, bar, baz]);
        });

        it('should carry the registered name on every element', () => {
            const local = new SchemaRegistry();
            local.add(defineSchema({ name: 'foo' }));
            local.add('bar', defineSchema({}));

            // typed string, not string | undefined: registration guarantees it
            const names : string[] = local.getAll().map((schema) => schema.name);

            expect(names).toEqual(['foo', 'bar']);
        });

        it('should return the same instances as get', () => {
            const local = new SchemaRegistry();
            const schema = defineSchema({ name: 'foo' });
            local.add(schema);

            expect(local.getAll()[0]).toBe(local.get('foo'));
        });

        it('should keep the position of a re-registered name', () => {
            const local = new SchemaRegistry();
            const foo = defineSchema({ name: 'foo' });
            const bar = defineSchema({ name: 'bar' });
            const fooReplacement = defineSchema({ name: 'foo' });

            local.add(foo);
            local.add(bar);
            local.add(fooReplacement);

            expect(local.getAll()).toEqual([fooReplacement, bar]);
        });

        it('should move a dropped and re-added schema to the end', () => {
            const local = new SchemaRegistry();
            const foo = defineSchema({ name: 'foo' });
            const bar = defineSchema({ name: 'bar' });

            local.add(foo);
            local.add(bar);
            local.drop('foo');
            local.add(foo);

            expect(local.getAll()).toEqual([bar, foo]);
        });

        it('should return a snapshot unaffected by later registry mutation', () => {
            const local = new SchemaRegistry();
            const foo = defineSchema({ name: 'foo' });
            local.add(foo);

            const schemas = local.getAll();

            local.add(defineSchema({ name: 'bar' }));
            local.drop('foo');

            expect(schemas).toEqual([foo]);
        });

        it('should not write back to the registry when the array is mutated', () => {
            const local = new SchemaRegistry();
            const foo = defineSchema({ name: 'foo' });
            local.add(foo);

            const other = new SchemaRegistry();
            other.add(defineSchema({ name: 'bar' }));

            const schemas = local.getAll();
            schemas.push(...other.getAll());
            schemas.reverse();

            expect(local.getAll()).toEqual([foo]);
            expect(local.get('bar')).toBeUndefined();
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
