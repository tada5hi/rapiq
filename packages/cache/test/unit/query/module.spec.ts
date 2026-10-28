/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    ITSELF,
    Query,
    SchemaRegistry,
    defineQuery,
    defineSchema,
    elemMatch,
    eq,
    inArray,
    or,
    preserve,
} from '@rapiq/core';
import {
    MemoryCacheDriver,
    TaggedCache,
    collectQueryTags,
    isCacheError,
    isCacheable,
    rememberQuery,
} from '../../../src';
import { registry, userRoleSchema } from '../../data/schema';
import type { Realm, Role, UserRole } from '../../data/type';

/**
 * A graph for filters applied to a relation itself: `role` reaches `realm`
 * (to-one) and `permissions` (to-many), `realm` reaches its `owner`, and
 * `labels` is a scalar array column that maps onto no schema.
 */
function buildRelationRegistry() : SchemaRegistry {
    const output = new SchemaRegistry();
    output.add(defineSchema({
        name: 'role',
        filters: { allowed: ['id', 'realm', 'permissions', 'labels'] },
        relations: { allowed: ['realm', 'permissions'] },
        indexes: [['id']],
        schemaMapping: { permissions: 'permission' },
    }));
    output.add(defineSchema({
        name: 'realm',
        filters: { allowed: ['id', 'name', 'owner'] },
        relations: { allowed: ['owner'] },
        indexes: [['id']],
        schemaMapping: { owner: 'user' },
    }));
    output.add(defineSchema({
        name: 'permission',
        filters: { allowed: ['id', 'name'] },
        indexes: [['id']],
    }));
    output.add(defineSchema({
        name: 'user',
        filters: { allowed: ['id', 'name'] },
        indexes: [['id']],
    }));

    return output;
}

describe('src/query/module.ts', () => {
    describe('isCacheable', () => {
        it('should accept a query without field conditions', () => {
            expect(isCacheable(defineQuery<Role>({ fields: ['id', 'name'], relations: ['realm'] }))).toBeTruthy();
        });

        it('should refuse a query whose root field carries a condition', () => {
            const query = new Query({
                fields: new Fields([
                    new Field('id'),
                    new Field('secret', undefined, eq('ownerId', 'u1')),
                ]),
            });

            expect(isCacheable(query)).toBeFalsy();
        });

        it('should refuse a query whose relation field carries a condition', () => {
            const query = new Query({
                fields: new Fields([
                    new Field('realm.name', undefined, eq('realm.ownerId', 'u1')),
                ]),
            });

            expect(isCacheable(query)).toBeFalsy();
        });
    });

    describe('collectQueryTags', () => {
        it('should emit the collection and record tags of the root and of an included relation', () => {
            const tags = collectQueryTags({
                query: defineQuery<Role>({ relations: ['realm'] }),
                schema: 'role',
                registry,
                value: [
                    {
                        id: 'r1', 
                        name: 'admin', 
                        realmId: 'x', 
                        realm: { id: 'x', name: 'master' }, 
                    },
                    {
                        id: 'r2', 
                        name: 'user', 
                        realmId: 'x', 
                        realm: { id: 'x', name: 'master' }, 
                    },
                ],
            });

            expect(tags).toEqual(['role', 'realm', 'role:r1', 'role:r2', 'realm:x']);
        });

        it('should accept a schema instance as well as a name', () => {
            const tags = collectQueryTags({
                query: defineQuery<Role>({}),
                schema: registry.getOrFail('role'),
                registry,
                value: { id: 'r1' },
            });

            expect(tags).toEqual(['role', 'role:r1']);
        });

        it('should still emit the collection tags for an empty result', () => {
            const tags = collectQueryTags({
                query: defineQuery<Role>({ relations: ['realm'] }),
                schema: 'role',
                registry,
                value: [],
            });

            expect(tags).toEqual(['role', 'realm']);
        });

        it('should emit nothing but the collection tag for a null result', () => {
            expect(collectQueryTags({
                query: defineQuery<Role>({}),
                schema: 'role',
                registry,
                value: null,
            })).toEqual(['role']);
        });

        it('should replace the collection tag with a scoped tag for an eq on an index-leading column', () => {
            const tags = collectQueryTags({
                query: defineQuery<UserRole>({ filters: { userId: 'u1' } }),
                schema: 'userRole',
                registry,
                caseSensitive: ['userId'],
                value: [{
                    id: 'ur1', 
                    userId: 'u1', 
                    roleId: 'r1', 
                }],
            });

            expect(tags).toEqual(['userRole:userId=u1', 'userRole:ur1']);
        });

        it('should emit one scoped tag per value of an in condition', () => {
            const tags = collectQueryTags({
                query: defineQuery<UserRole>({ filters: inArray('userId', ['u1', 'u2']) }),
                schema: 'userRole',
                registry,
                caseSensitive: ['userId'],
                value: [],
            });

            expect(tags).toEqual(['userRole:userId=u1', 'userRole:userId=u2']);
        });

        it('should scope on every index-leading conjunct of a root AND', () => {
            const tags = collectQueryTags({
                query: defineQuery<UserRole>({ filters: { userId: 'u1', roleId: 'r1' } }),
                schema: 'userRole',
                registry,
                caseSensitive: true,
                value: [],
            });

            expect(tags).toEqual(['userRole:userId=u1', 'userRole:roleId=r1']);
        });

        it('should not scope on a date string, which the writer never spells alike', () => {
            // the writer's row holds a `Date` (no scoped tag) or the
            // database's storage form, never the ISO string the wire carried.
            expect(collectQueryTags({
                query: defineQuery<UserRole>({ filters: { userId: '2026-01-02T03:04:05.000Z' } }),
                schema: 'userRole',
                registry,
                caseSensitive: true,
                value: [],
            })).toEqual(['userRole']);

            expect(collectQueryTags({
                query: defineQuery<UserRole>({ filters: inArray('userId', ['u1', '2026-01-02']) }),
                schema: 'userRole',
                registry,
                caseSensitive: true,
                value: [],
            })).toEqual(['userRole']);
        });

        it('should not scope a string on a column compared case-insensitively', () => {
            // `realm.name` leads an index but the query is not executed
            // case-sensitively on it: `Master` matches a row holding
            // `master`, whose write bumps `realm:name=master`.
            expect(collectQueryTags({
                query: defineQuery<Realm>({ filters: { name: 'Master' } }),
                schema: 'realm',
                registry,
                caseSensitive: ['id'],
                value: [],
            })).toEqual(['realm']);

            expect(collectQueryTags({
                query: defineQuery<Realm>({ filters: { id: 'r1' } }),
                schema: 'realm',
                registry,
                caseSensitive: ['id'],
                value: [],
            })).toEqual(['realm:id=r1']);

            expect(collectQueryTags({
                query: defineQuery<Realm>({ filters: { name: 'master' } }),
                schema: 'realm',
                registry,
                caseSensitive: true,
                value: [],
            })).toEqual(['realm:name=master']);
        });

        it('should read case sensitivity from the execute option, never from the schema', () => {
            // `userId` is listed under the schema's `filters.caseSensitive`,
            // but an adapter executed without the option folds the
            // comparison: `U1` matches a row holding `u1`.
            expect(userRoleSchema.filters.caseSensitive).toContain('userId');

            for (const caseSensitive of [undefined, false, [] as string[], ['roleId']]) {
                expect(collectQueryTags({
                    query: defineQuery<UserRole>({ filters: { userId: 'U1' } }),
                    schema: 'userRole',
                    registry,
                    caseSensitive,
                    value: [],
                })).toEqual(['userRole']);
            }

            // a number never folds, so it scopes whatever the option says.
            expect(collectQueryTags({
                query: defineQuery({ filters: eq('userId', 7) }),
                schema: 'userRole',
                registry,
                value: [],
            })).toEqual(['userRole:userId=7']);
        });

        it('should spell a boolean and a number, and a Date and its epoch, alike', () => {
            const date = new Date('2026-01-02T03:04:05.000Z');

            const tagsOf = (value: unknown) => collectQueryTags({
                query: defineQuery({ filters: eq('realmId', value) }),
                schema: 'role',
                registry,
                value: [],
            });

            expect(tagsOf(true)).toEqual(tagsOf(1));
            expect(tagsOf(false)).toEqual(tagsOf(0));
            expect(tagsOf(date)).toEqual(tagsOf(date.getTime()));
            expect(tagsOf(date)).toEqual([`role:realmId=${date.getTime()}`]);

            // an invalid Date has no spelling, and a date string never
            // scopes, even on a case-sensitive column.
            expect(tagsOf(new Date(NaN))).toEqual(['role']);
            expect(collectQueryTags({
                query: defineQuery({ filters: eq('realmId', date.toISOString()) }),
                schema: 'role',
                registry,
                caseSensitive: true,
                value: [],
            })).toEqual(['role']);
        });

        it('should fall back to the collection tag for a filter on a column leading no index', () => {
            const tags = collectQueryTags({
                query: defineQuery<Role>({ filters: { name: 'admin' } }),
                schema: 'role',
                registry,
                value: [],
            });

            expect(tags).toEqual(['role']);
        });

        it('should spell a null scope as null', () => {
            const tags = collectQueryTags({
                query: defineQuery<Role>({ filters: eq('realmId', null) }),
                schema: 'role',
                registry,
                value: [],
            });

            expect(tags).toEqual(['role:realmId=null']);
        });

        it('should not scope on a non-scalar value', () => {
            const tags = collectQueryTags({
                query: defineQuery<Role>({ filters: inArray('realmId', ['x', { nested: true } as never]) }),
                schema: 'role',
                registry,
                caseSensitive: true,
                value: [],
            });

            expect(tags).toEqual(['role']);
        });

        it('should add the relation collection tag for a dotted filter', () => {
            const tags = collectQueryTags({
                query: defineQuery<Role>({ filters: { 'realm.name': 'master' } }),
                schema: 'role',
                registry,
                value: [],
            });

            expect(tags).toEqual(['role', 'realm']);
        });

        it('should add the relation collection tag for a dotted sort key and a dotted field', () => {
            expect(collectQueryTags({
                query: defineQuery<Role>({ sorts: ['realm.name'] }),
                schema: 'role',
                registry,
                value: [],
            })).toEqual(['role', 'realm']);

            expect(collectQueryTags({
                query: defineQuery<Role>({ fields: ['id', 'realm.name'] }),
                schema: 'role',
                registry,
                value: [],
            })).toEqual(['role', 'realm']);
        });

        it('should refuse an elemMatch on a declared relation whose schema is not registered', () => {
            // `user` is in userRole's relations.allowed, but no `user` schema exists.
            let error : unknown;
            try {
                collectQueryTags({
                    query: defineQuery({ filters: elemMatch('user', eq('name', 'x')) }),
                    schema: 'userRole',
                    registry,
                    value: [],
                });
            } catch (e) {
                error = e;
            }

            expect(isCacheError(error)).toBe(true);
        });

        it('should add the relation collection tag for an elemMatch on a to-one relation', () => {
            const relationRegistry = buildRelationRegistry();

            expect(collectQueryTags({
                query: defineQuery({ filters: elemMatch('realm', eq('name', 'master')) }),
                schema: 'role',
                registry: relationRegistry,
                value: [{ id: 'r1' }],
            })).toEqual(['role', 'realm', 'role:r1']);
        });

        it('should add the relation collection tag for an elemMatch on a to-many relation', () => {
            expect(collectQueryTags({
                query: defineQuery({ filters: elemMatch('permissions', eq('name', 'x')) }),
                schema: 'role',
                registry: buildRelationRegistry(),
                value: [],
            })).toEqual(['role', 'permission']);
        });

        it('should resolve the keys of an elemMatch interior against the relation', () => {
            const relationRegistry = buildRelationRegistry();

            // a dotted interior key walks on from the relation.
            expect(collectQueryTags({
                query: defineQuery({ filters: elemMatch('realm', eq('owner.name', 'admin')) }),
                schema: 'role',
                registry: relationRegistry,
                value: [],
            })).toEqual(['role', 'realm', 'user']);

            // so does a nested elemMatch, and an ITSELF leaf adds nothing.
            expect(collectQueryTags({
                query: defineQuery({ filters: elemMatch('realm', elemMatch('owner', eq(ITSELF, 'u1'))) }),
                schema: 'role',
                registry: relationRegistry,
                value: [],
            })).toEqual(['role', 'realm', 'user']);
        });

        it('should add no relation tag and not throw for an elemMatch on a scalar or JSON array', () => {
            const relationRegistry = buildRelationRegistry();

            expect(collectQueryTags({
                query: defineQuery({ filters: elemMatch('labels', eq(ITSELF, 'a')) }),
                schema: 'role',
                registry: relationRegistry,
                value: [],
            })).toEqual(['role']);

            // an array of objects: the interior key is a property, no join.
            expect(collectQueryTags({
                query: defineQuery({ filters: elemMatch('labels', eq('code', 'a')) }),
                schema: 'role',
                registry: relationRegistry,
                value: [],
            })).toEqual(['role']);
        });

        it('should not scope on an OR root', () => {
            const tags = collectQueryTags({
                query: defineQuery<UserRole>({ filters: or(eq('userId', 'u1'), eq('userId', 'u2')) }),
                schema: 'userRole',
                registry,
                caseSensitive: true,
                value: [],
            });

            expect(tags).toEqual(['userRole']);
        });

        it('should treat a preserved root AND as one non-scoping conjunct', () => {
            const tags = collectQueryTags({
                query: new Query({ filters: preserve(defineQuery<UserRole>({ filters: { userId: 'u1' } }).filters) }),
                schema: 'userRole',
                registry,
                caseSensitive: true,
                value: [],
            });

            expect(tags).toEqual(['userRole']);
        });

        it('should not scope on a dotted eq but still add its relation tag', () => {
            const tags = collectQueryTags({
                query: defineQuery<Role>({ filters: { 'realm.id': 'x' } }),
                schema: 'role',
                registry,
                caseSensitive: true,
                value: [],
            });

            expect(tags).toEqual(['role', 'realm']);
        });

        it('should follow a relation that holds an array of rows', () => {
            const tags = collectQueryTags({
                query: defineQuery<UserRole>({ relations: ['role'] }),
                schema: 'userRole',
                registry,
                value: {
                    id: 'ur1', 
                    userId: 'u1', 
                    roleId: 'r1', 
                    role: [{ id: 'r1' }, { id: 'r2' }], 
                },
            });

            expect(tags).toEqual(['userRole', 'role', 'userRole:ur1', 'role:r1', 'role:r2']);
        });

        it('should follow a nested relation path and tag every level', () => {
            const tags = collectQueryTags({
                query: defineQuery<UserRole>({ relations: ['role.realm'] }),
                schema: 'userRole',
                registry,
                value: { id: 'ur1', role: { id: 'r1', realm: { id: 'x' } } },
            });

            expect(tags).toEqual(['userRole', 'role', 'realm', 'userRole:ur1', 'role:r1', 'realm:x']);
        });

        it('should take the record tags from the rows the extractor returns', () => {
            // a findAndCount tuple
            expect(collectQueryTags({
                query: defineQuery<Role>({ relations: ['realm'] }),
                schema: 'role',
                registry,
                value: [[{ id: 'r1', realm: { id: 'x' } }], 1] as [Record<string, any>[], number],
                rows: ([rows]) => rows,
            })).toEqual(['role', 'realm', 'role:r1', 'realm:x']);

            // an envelope
            expect(collectQueryTags({
                query: defineQuery<Role>({}),
                schema: 'role',
                registry,
                value: { data: [{ id: 'r1' }, { id: 'r2' }], meta: { total: 2 } },
                rows: (value) => value.data,
            })).toEqual(['role', 'role:r1', 'role:r2']);
        });

        it('should skip a row without the key property and honour a custom key', () => {
            expect(collectQueryTags({
                query: defineQuery<Role>({}),
                schema: 'role',
                registry,
                value: [{ name: 'no id' }],
            })).toEqual(['role']);

            expect(collectQueryTags({
                query: defineQuery<Role>({}),
                schema: 'role',
                registry,
                value: [{ name: 'admin' }],
                primaryKey: 'name',
            })).toEqual(['role', 'role:admin']);
        });

        it('should throw a CacheError for a relation the registry cannot resolve', () => {
            let error : unknown;
            try {
                collectQueryTags({
                    query: defineQuery<UserRole>({ relations: ['user'] }),
                    schema: 'userRole',
                    registry,
                    value: [],
                });
            } catch (e) {
                error = e;
            }

            expect(isCacheError(error)).toBeTruthy();
            expect((error as Error).message).toMatch(/user/);
        });

        it('should throw a CacheError for a root schema the registry lacks', () => {
            expect(() => collectQueryTags({
                query: defineQuery({}),
                schema: 'unknown',
                registry,
                value: [],
            })).toThrow(/unknown/);
        });
    });

    describe('rememberQuery', () => {
        it('should cache a cacheable query under the derived tags', async () => {
            const cache = new TaggedCache({ driver: new MemoryCacheDriver() });
            let reads = 0;
            const rows = [{
                id: 'r1', 
                name: 'admin', 
                realmId: 'x', 
                realm: { id: 'x', name: 'master' }, 
            }];
            const read = async () => {
                reads++;
                return rows;
            };
            const input = {
                key: 'roles?include=realm',
                query: defineQuery<Role>({ relations: ['realm'] }),
                schema: 'role',
                registry,
            };

            expect(await rememberQuery(cache, input, read)).toEqual(rows);
            expect(await rememberQuery(cache, input, read)).toEqual(rows);
            expect(reads).toEqual(1);

            await cache.invalidate(['realm:x']);

            expect(await rememberQuery(cache, input, read)).toEqual(rows);
            expect(reads).toEqual(2);
        });

        it('should bypass the cache for a query that is not cacheable', async () => {
            const cache = new TaggedCache({ driver: new MemoryCacheDriver() });
            let reads = 0;
            const read = async () => {
                reads++;
                return [];
            };
            const input = {
                key: 'roles',
                query: new Query({ fields: new Fields([new Field('secret', undefined, eq('ownerId', 'u1'))]) }),
                schema: 'role',
                registry,
            };

            await rememberQuery(cache, input, read);
            await rememberQuery(cache, input, read);
            expect(reads).toEqual(2);
        });

        it('should invalidate an elemMatch read through the relation collection tag', async () => {
            const cache = new TaggedCache({ driver: new MemoryCacheDriver() });
            let reads = 0;
            const input = {
                key: 'role?filter=elemMatch(realm,eq(name,master))',
                query: defineQuery({ filters: elemMatch('realm', eq('name', 'master')) }),
                schema: 'role',
                registry: buildRelationRegistry(),
            };
            const read = async () => {
                reads++;
                return [{ id: 'r1' }];
            };

            await rememberQuery(cache, input, read);
            await rememberQuery(cache, input, read);
            expect(reads).toEqual(1);

            // a realm rename bumps `realm`, which the read depends on.
            await cache.invalidate(['realm']);

            await rememberQuery(cache, input, read);
            expect(reads).toEqual(2);
        });

        it('should forward the rows extractor and the case sensitivity', async () => {
            const driver = new MemoryCacheDriver();
            const cache = new TaggedCache({ driver });

            await rememberQuery(cache, {
                key: 'userRole?filter[userId]=u1',
                query: defineQuery<UserRole>({ filters: { userId: 'u1' } }),
                schema: 'userRole',
                registry,
                caseSensitive: ['userId'],
                rows: ([rows]) => rows,
            }, async () => [[{ id: 'ur1', userId: 'u1' }], 1] as [Record<string, any>[], number]);

            const hit = await driver.read('userRole?filter[userId]=u1');
            expect(hit?.tags).toEqual(['userRole:userId=u1', 'userRole:ur1']);
        });

        it('should honour a custom primary key', async () => {
            const driver = new MemoryCacheDriver();
            const cache = new TaggedCache({ driver });

            await rememberQuery(cache, {
                key: 'roles',
                query: defineQuery<Role>({}),
                schema: 'role',
                registry,
                primaryKey: 'name',
            }, async () => [{ name: 'admin' }]);

            const hit = await driver.read('roles');
            expect(hit?.tags).toEqual(['role', 'role:admin']);
        });
    });
});
