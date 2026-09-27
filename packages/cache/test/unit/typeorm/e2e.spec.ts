/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { defineQuery } from '@rapiq/core';
import type { DataSource } from 'typeorm';
import {
    MemoryCacheDriver,
    TaggedCache,
    rememberQuery,
} from '../../../src';
import { CacheInvalidationSubscriber } from '../../../src/typeorm';
import {
    ArticleEntity,
    RealmEntity,
    RoleEntity,
    TagEntity,
    UserRoleEntity,
    resolveSchemaName,
} from '../../data/entity';
import { createDataSource } from '../../data/factory';
import { registry } from '../../data/schema';
import type { Article, Role, UserRole } from '../../data/type';

describe('typeorm end to end', () => {
    let dataSource : DataSource;

    let cache : TaggedCache;

    beforeEach(async () => {
        cache = new TaggedCache({
            driver: new MemoryCacheDriver(),
            onError: (e) => {
                throw e;
            },
        });

        dataSource = await createDataSource([
            new CacheInvalidationSubscriber({
                cache,
                registry,
                resolveSchemaName,
                onError: (e) => {
                    throw e;
                },
            }),
        ]);

        await dataSource.getRepository(RealmEntity).save({ id: 'x', name: 'master' });
        await dataSource.getRepository(RoleEntity).save({
            id: 'r1', 
            name: 'admin', 
            realmId: 'x', 
        });
    });

    afterEach(async () => {
        await dataSource.destroy();
    });

    it('should serve a fresh role after its realm was updated', async () => {
        const query = defineQuery<Role>({ relations: ['realm'] });
        let reads = 0;

        const read = () => rememberQuery(cache, {
            key: 'role?include=realm',
            query,
            schema: 'role',
            registry,
        }, async () => {
            reads++;
            return dataSource.getRepository(RoleEntity).find({ relations: { realm: true } });
        });

        const first = await read();
        expect(first).toHaveLength(1);
        expect(first[0]?.realm.name).toEqual('master');

        const second = await read();
        expect(second[0]?.realm.name).toEqual('master');
        expect(reads).toEqual(1);

        const realmRepository = dataSource.getRepository(RealmEntity);
        const realm = await realmRepository.findOneByOrFail({ id: 'x' });
        realm.name = 'renamed';
        await realmRepository.save(realm);

        const third = await read();
        expect(third[0]?.realm.name).toEqual('renamed');
        expect(reads).toEqual(2);
    });

    it('should serve a fresh list after a role was added', async () => {
        const query = defineQuery<Role>({});
        let reads = 0;

        const read = () => rememberQuery(cache, {
            key: 'role',
            query,
            schema: 'role',
            registry,
        }, async () => {
            reads++;
            return dataSource.getRepository(RoleEntity).find();
        });

        expect(await read()).toHaveLength(1);
        expect(await read()).toHaveLength(1);
        expect(reads).toEqual(1);

        await dataSource.getRepository(RoleEntity).save({
            id: 'r2', 
            name: 'user', 
            realmId: 'x', 
        });

        expect(await read()).toHaveLength(2);
        expect(reads).toEqual(2);
    });

    it('should reach a scoped reader through a cascade only on the scoped column', async () => {
        await dataSource.getRepository(UserRoleEntity).save({
            id: 'ur1', 
            userId: 'u1', 
            roleId: 'r1', 
        });

        const repository = dataSource.getRepository(UserRoleEntity);
        const reads = { byRole: 0, byUser: 0 };

        const byRole = () => rememberQuery(cache, {
            key: 'userRole?filter[roleId]=r1',
            query: defineQuery<UserRole>({ filters: { roleId: 'r1' } }),
            schema: 'userRole',
            registry,
        }, async () => {
            reads.byRole++;
            return repository.findBy({ roleId: 'r1' });
        });

        const byUser = () => rememberQuery(cache, {
            key: 'userRole?filter[userId]=u1',
            query: defineQuery<UserRole>({ filters: { userId: 'u1' } }),
            schema: 'userRole',
            registry,
        }, async () => {
            reads.byUser++;
            return repository.findBy({ userId: 'u1' });
        });

        expect(await byRole()).toHaveLength(1);
        expect(await byUser()).toHaveLength(1);

        // the database cascades ur1 away; the subscriber bumps the child
        // collection and the join column scoped to r1, and nothing else.
        const roles = dataSource.getRepository(RoleEntity);
        await roles.remove(await roles.findOneByOrFail({ id: 'r1' }));

        expect(await byRole()).toHaveLength(0);
        expect(reads.byRole).toEqual(2);

        // the documented boundary: a reader scoped on another column is
        // not reached, since no bump names `userId=u1` or the row ur1.
        expect(await byUser()).toHaveLength(1);
        expect(reads.byUser).toEqual(1);
    });

    it('should serve a fresh junction list after a grandparent cascaded it away', async () => {
        await dataSource.getRepository(UserRoleEntity).save({
            id: 'ur1',
            userId: 'u1',
            roleId: 'r1',
        });

        let reads = 0;
        const read = () => rememberQuery(cache, {
            key: 'userRole',
            query: defineQuery<UserRole>({}),
            schema: 'userRole',
            registry,
        }, async () => {
            reads++;
            return dataSource.getRepository(UserRoleEntity).find();
        });

        expect(await read()).toHaveLength(1);

        const realms = dataSource.getRepository(RealmEntity);
        await realms.remove(await realms.findOneByOrFail({ id: 'x' }));

        expect(await read()).toHaveLength(0);
        expect(reads).toEqual(2);
    });

    it('should serve a fresh many-to-many relation after a link', async () => {
        await dataSource.getRepository(TagEntity).save({ id: 't1', name: 'news' });
        await dataSource.getRepository(ArticleEntity).save({ id: 'a1', title: 'hello' });

        const articles = dataSource.getRepository(ArticleEntity);
        let reads = 0;
        const read = () => rememberQuery(cache, {
            key: 'article?include=tags',
            query: defineQuery<Article>({ filters: { id: 'a1' }, relations: ['tags'] }),
            schema: 'article',
            registry,
        }, async () => {
            reads++;
            return articles.find({ where: { id: 'a1' }, relations: { tags: true } });
        });

        expect((await read())[0]?.tags).toHaveLength(0);

        await dataSource.createQueryBuilder().relation(ArticleEntity, 'tags').of('a1').add('t1');

        expect((await read())[0]?.tags).toHaveLength(1);

        await dataSource.createQueryBuilder().relation(ArticleEntity, 'tags').of('a1').remove('t1');

        expect((await read())[0]?.tags).toHaveLength(0);
        expect(reads).toEqual(3);
    });

    it('should not reach a by-id read through a pk-less update (documented boundary)', async () => {
        const roles = dataSource.getRepository(RoleEntity);
        let reads = 0;
        const read = () => rememberQuery(cache, {
            key: 'role?filter[id]=r1',
            query: defineQuery<Role>({ filters: { id: 'r1' } }),
            schema: 'role',
            registry,
        }, async () => {
            reads++;
            return roles.findBy({ id: 'r1' });
        });

        expect((await read())[0]?.name).toEqual('admin');

        await roles.update({ id: 'r1' }, { name: 'owner' });

        // `update` bumps `role` alone; the read carries `role:id=r1`.
        expect((await read())[0]?.name).toEqual('admin');
        expect(reads).toEqual(1);
    });
});
