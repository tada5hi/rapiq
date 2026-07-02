/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FiltersParseError,
    FiltersSchema,
    KeyResolutionErrorCode,
    Parameter,
    Relation,
    Relations,
    ResolutionScope,
    SchemaRegistry,
    SortParseError,
    defineFiltersSchema,
    defineSchema,
} from '../../../src';
import { registry } from '../../data/schema';

describe('src/schema/resolver/*.ts', () => {
    describe('schema input normalization', () => {
        it('should resolve a registry name to the parameter sub-schema', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user');

            expect(scope.schema).toBeInstanceOf(FiltersSchema);
            expect(scope.schema.allowed).toEqual(['id', 'name', 'email']);
            expect(scope.segment).toBeUndefined();
        });

        it('should project the sub-schema from a Schema instance', () => {
            const schema = registry.getOrFail('user');
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, schema);

            expect(scope.schema).toBe(schema.filters);
        });

        it('should pass a bare sub-schema through unchanged', () => {
            const schema = defineFiltersSchema({ allowed: ['id'] });
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, schema);

            expect(scope.schema).toBe(schema);
        });

        it('should fall back to an empty schema for undefined input', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS);

            expect(scope.schema).toBeInstanceOf(FiltersSchema);
            expect(scope.schema.allowedIsUndefined).toBeTruthy();
        });

        it('should throw for an unknown registry name', () => {
            expect(() => ResolutionScope.for(registry, Parameter.FILTERS, 'unknown')).toThrow();
        });

        it('should produce equivalent scopes for name and instance input', () => {
            const byName = ResolutionScope.for(registry, Parameter.SORT, 'user');
            const byInstance = ResolutionScope.for(registry, Parameter.SORT, registry.getOrFail('user'));

            expect(byName.schema).toBe(byInstance.schema);
        });
    });

    describe('resolveKey (local)', () => {
        it('should resolve an allowed key', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user');
            const resolved = scope.resolveKey('name');

            expect(resolved.ok).toBeTruthy();
            if (resolved.ok) {
                expect(resolved.name).toEqual('name');
                expect(resolved.path).toEqual([]);
                expect(resolved.scope).toBe(scope);
            }
        });

        it('should apply mapping aliases before validation', () => {
            const schema = defineFiltersSchema({
                allowed: ['id'],
                mapping: { aliasId: 'id' },
            });
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, schema);
            const resolved = scope.resolveKey('aliasId');

            expect(resolved.ok).toBeTruthy();
            if (resolved.ok) {
                expect(resolved.name).toEqual('id');
            }
        });

        it('should reject a key missing from the allow-list', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user');
            const resolved = scope.resolveKey('age');

            expect(resolved).toEqual({
                ok: false,
                code: KeyResolutionErrorCode.KEY_NOT_PERMITTED,
                input: 'age',
                segment: 'age',
            });
        });

        it('should reject a syntactically invalid key under an open schema', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS);

            expect(scope.resolveKey('foo').ok).toBeTruthy();
            expect(scope.resolveKey('1foo')).toEqual({
                ok: false,
                code: KeyResolutionErrorCode.KEY_INVALID,
                input: '1foo',
                segment: '1foo',
            });
        });
    });

    describe('resolveKey (dotted)', () => {
        it('should walk a relation path through schemaMapping to the leaf schema', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user');
            const resolved = scope.resolveKey('items.id');

            expect(resolved.ok).toBeTruthy();
            if (resolved.ok) {
                expect(resolved.name).toEqual('id');
                expect(resolved.path).toEqual(['items']);
                expect(resolved.scope.schema.name).toEqual('item');
            }
        });

        it('should validate the leaf against the target schema', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user');
            const resolved = scope.resolveKey('items.name');

            expect(resolved).toEqual({
                ok: false,
                code: KeyResolutionErrorCode.KEY_NOT_PERMITTED,
                input: 'items.name',
                segment: 'name',
            });
        });

        it('should report unresolvable segments', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user');
            const resolved = scope.resolveKey('unknown.id');

            expect(resolved).toEqual({
                ok: false,
                code: KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE,
                input: 'unknown.id',
                segment: 'unknown',
            });
        });

        it('should report segments not covered by the relations context', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user', { relations: new Relations([new Relation('realm')]) });
            const resolved = scope.resolveKey('items.id');

            expect(resolved).toEqual({
                ok: false,
                code: KeyResolutionErrorCode.PATH_NOT_PERMITTED,
                input: 'items.id',
                segment: 'items',
            });
        });

        it('should permit segments covered by the relations context', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user', { relations: new Relations([new Relation('items')]) });

            expect(scope.resolveKey('items.id').ok).toBeTruthy();
        });
    });

    describe('failure policy', () => {
        it('should throw when the schema sets throwOnFailure', () => {
            const schema = defineFiltersSchema({
                allowed: ['id'],
                throwOnFailure: true,
            });
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, schema);

            expect(() => scope.resolveKey('bar')).toThrow(FiltersParseError);
            expect(() => scope.resolveKey('bar')).toThrow('The key bar is not permitted.');
        });

        it('should let a context override take precedence over the schema setting', () => {
            const schema = defineFiltersSchema({
                allowed: ['id'],
                throwOnFailure: true,
            });
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, schema, { throwOnFailure: false });

            expect(scope.resolveKey('bar').ok).toBeFalsy();
        });

        it('should throw the parameter error class', () => {
            const scope = ResolutionScope.for(registry, Parameter.SORT, 'user', { throwOnFailure: true });

            expect(() => scope.resolveKey('bar')).toThrow(SortParseError);
        });

        it('should throw the parameter error class for relation path failures', () => {
            const scope = ResolutionScope.for(registry, Parameter.SORT, 'user', {
                relations: new Relations([new Relation('realm')]),
                throwOnFailure: true,
            });

            expect(() => scope.descend('items')).toThrow(SortParseError);
            expect(() => scope.descend('items')).toThrow('The key path items is invalid.');
        });

        it('should inherit the policy override through descend', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user', { throwOnFailure: true });

            const child = scope.descend('items');
            expect(child).toBeInstanceOf(ResolutionScope);
            if (child instanceof ResolutionScope) {
                expect(() => child.resolveKey('bar')).toThrow(FiltersParseError);
            }
        });
    });

    describe('descend', () => {
        it('should resolve the child schema and extract the relations sub-tree', () => {
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user', {
                relations: new Relations([
                    new Relation('items'),
                    new Relation('items.realm'),
                ]),
            });

            const child = scope.descend('items');
            expect(child).toBeInstanceOf(ResolutionScope);
            if (child instanceof ResolutionScope) {
                expect(child.segment).toEqual('items');
                expect(child.schema.name).toEqual('item');
                expect(child.relations).toBeDefined();
                expect(child.relations!.value.map((el) => el.name)).toEqual(['realm']);
            }
        });

        it('should apply mapping aliases to relation segments', () => {
            const scope = ResolutionScope.for(registry, Parameter.RELATIONS, 'user');

            const child = scope.descend('abc');
            expect(child).toBeInstanceOf(ResolutionScope);
            if (child instanceof ResolutionScope) {
                expect(child.segment).toEqual('items');
                expect(child.schema.name).toEqual('item');
            }
        });

        it('should honor schemaMapping of an unregistered schema instance', () => {
            const schema = defineSchema({
                filters: { allowed: ['id'] },
                schemaMapping: { stuff: 'item' },
            });
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, schema);

            const child = scope.descend('stuff');
            expect(child).toBeInstanceOf(ResolutionScope);
            if (child instanceof ResolutionScope) {
                expect(child.schema.name).toEqual('item');
            }
        });

        it('should reject relation segments outside the relations allow-list', () => {
            const scope = ResolutionScope.for(registry, Parameter.RELATIONS, 'user');

            expect(scope.descend('foo')).toEqual({
                ok: false,
                code: KeyResolutionErrorCode.PATH_NOT_PERMITTED,
                input: 'foo',
                segment: 'foo',
            });
        });

        it('should descend into an unbound scope for unresolvable relations segments', () => {
            const local = new SchemaRegistry();
            const schema = defineSchema({ relations: { allowed: ['foo'] } });
            const scope = ResolutionScope.for(local, Parameter.RELATIONS, schema);

            const child = scope.descend('foo');
            expect(child).toBeInstanceOf(ResolutionScope);
            if (child instanceof ResolutionScope) {
                expect(child.schema.allowed).toBeUndefined();
            }
        });

        it('should fail for unresolvable segments of a bound schema', () => {
            const local = new SchemaRegistry();
            const schema = defineSchema({
                name: 'foo',
                sort: { allowed: ['id'] },
            });
            const scope = ResolutionScope.for(local, Parameter.SORT, schema);

            expect(scope.descend('bar')).toEqual({
                ok: false,
                code: KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE,
                input: 'bar',
                segment: 'bar',
            });
        });

        it('should descend an unbound scope without traversal constraints', () => {
            const local = new SchemaRegistry();
            const scope = ResolutionScope.for(local, Parameter.FIELDS);

            const child = scope.descend('realm');
            expect(child).toBeInstanceOf(ResolutionScope);
            if (child instanceof ResolutionScope) {
                expect(child.schema.allowedIsUndefined).toBeTruthy();
                expect(child.resolveKey('name').ok).toBeTruthy();
            }
        });

        it('should resolve traversal from a named bare sub-schema via the registry', () => {
            const schema = registry.getOrFail('user').filters;
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, schema);

            const child = scope.descend('items');
            expect(child).toBeInstanceOf(ResolutionScope);
            if (child instanceof ResolutionScope) {
                // resolved through the user schema's schemaMapping
                expect(child.schema.name).toEqual('item');
            }
        });
    });

    describe('multi-segment aliases', () => {
        it('should expand a dotted mapping target in resolveKey', () => {
            const schema = defineSchema({
                filters: {
                    allowed: ['id'],
                    mapping: { realmName: 'realm.name' },
                },
            });
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, schema);

            const resolved = scope.resolveKey('realmName');
            expect(resolved.ok).toBeTruthy();
            if (resolved.ok) {
                expect(resolved.name).toEqual('name');
                expect(resolved.path).toEqual(['realm']);
                expect(resolved.scope.schema.name).toEqual('realm');
            }
        });

        it('should walk every segment of a dotted mapping target in descend', () => {
            const schema = defineSchema({
                relations: {
                    allowed: ['items', 'items.realm'],
                    mapping: { abc: 'items.realm' },
                },
                schemaMapping: { items: 'item' },
            });
            const scope = ResolutionScope.for(registry, Parameter.RELATIONS, schema);

            const child = scope.descend('abc');
            expect(child).toBeInstanceOf(ResolutionScope);
            if (child instanceof ResolutionScope) {
                expect(child.segment).toEqual('items.realm');
                expect(child.schema.name).toEqual('realm');
            }
        });

        it('should bound cyclic mapping expansion instead of recursing forever', () => {
            const local = new SchemaRegistry();
            local.add(defineSchema({
                name: 'user',
                filters: {
                    allowed: ['id'],
                    mapping: { p: 'parent.p' },
                },
                schemaMapping: { parent: 'user' },
            }));
            const scope = ResolutionScope.for(local, Parameter.FILTERS, 'user');

            const resolved = scope.resolveKey('p');
            expect(resolved.ok).toBeFalsy();
            if (!resolved.ok) {
                expect(resolved.code).toEqual(KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE);
            }
        });

        it('should resolve dotted relation keys per level', () => {
            const scope = ResolutionScope.for(registry, Parameter.RELATIONS, 'user');

            const resolved = scope.resolveKey('items.realm');
            expect(resolved.ok).toBeTruthy();
            if (resolved.ok) {
                expect(resolved.name).toEqual('realm');
                expect(resolved.path).toEqual(['items']);
                expect(resolved.scope.schema.name).toEqual('item');
            }
        });
    });

    describe('failure policy (inheritance & overrides)', () => {
        it('should apply the child schema failure policy when no override is set', () => {
            const local = new SchemaRegistry();
            local.add(defineSchema({
                name: 'parent',
                filters: { allowed: ['id'] },
                schemaMapping: { kid: 'kiddo' },
            }));
            local.add(defineSchema({
                name: 'kiddo',
                throwOnFailure: true,
                filters: { allowed: ['id'] },
            }));

            const scope = ResolutionScope.for(local, Parameter.FILTERS, 'parent');
            expect(scope.resolveKey('bar').ok).toBeFalsy();

            const child = scope.descend('kid');
            expect(child).toBeInstanceOf(ResolutionScope);
            if (child instanceof ResolutionScope) {
                expect(() => child.resolveKey('bar')).toThrow(FiltersParseError);
            }
        });

        it('should honor a custom error class', () => {
            const schema = defineFiltersSchema({
                allowed: ['id'],
                throwOnFailure: true,
            });
            const scope = ResolutionScope.for(registry, Parameter.FILTERS, schema, { errors: SortParseError });

            expect(() => scope.resolveKey('bar')).toThrow(SortParseError);
        });
    });
});
