/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Query,
    defineQuery,
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
import { registry } from '../../data/schema';
import type { Role, UserRole } from '../../data/type';

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
                value: [],
            });

            expect(tags).toEqual(['userRole:userId=u1', 'userRole:userId=u2']);
        });

        it('should scope on every index-leading conjunct of a root AND', () => {
            const tags = collectQueryTags({
                query: defineQuery<UserRole>({ filters: { userId: 'u1', roleId: 'r1' } }),
                schema: 'userRole',
                registry,
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
                value: [],
            })).toEqual(['userRole']);

            expect(collectQueryTags({
                query: defineQuery<UserRole>({ filters: inArray('userId', ['u1', '2026-01-02']) }),
                schema: 'userRole',
                registry,
                value: [],
            })).toEqual(['userRole']);
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

        it('should not scope on an OR root', () => {
            const tags = collectQueryTags({
                query: defineQuery<UserRole>({ filters: or(eq('userId', 'u1'), eq('userId', 'u2')) }),
                schema: 'userRole',
                registry,
                value: [],
            });

            expect(tags).toEqual(['userRole']);
        });

        it('should treat a preserved root AND as one non-scoping conjunct', () => {
            const tags = collectQueryTags({
                query: new Query({ filters: preserve(defineQuery<UserRole>({ filters: { userId: 'u1' } }).filters) }),
                schema: 'userRole',
                registry,
                value: [],
            });

            expect(tags).toEqual(['userRole']);
        });

        it('should not scope on a dotted eq but still add its relation tag', () => {
            const tags = collectQueryTags({
                query: defineQuery<Role>({ filters: { 'realm.id': 'x' } }),
                schema: 'role',
                registry,
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
                key: 'name',
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
