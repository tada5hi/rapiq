/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSource } from 'typeorm';
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

describe('src/typeorm/module.ts', () => {
    let dataSource : DataSource;

    let calls : string[][];

    let errors : unknown[];

    let failInvalidate : boolean;

    beforeEach(async () => {
        calls = [];
        errors = [];
        failInvalidate = false;

        const subscriber = new CacheInvalidationSubscriber({
            cache: {
                invalidate: async (tags) => {
                    if (failInvalidate) {
                        throw new Error('store unavailable');
                    }

                    calls.push(tags);
                },
            },
            registry,
            resolveSchemaName,
            onError: (e) => {
                errors.push(e);
            },
        });

        dataSource = await createDataSource([subscriber]);

        await dataSource.getRepository(RealmEntity).insert({ id: 'x', name: 'master' });
        await dataSource.getRepository(RealmEntity).insert({ id: 'y', name: 'tenant' });
        calls = [];
    });

    afterEach(async () => {
        await dataSource.destroy();
    });

    it('should bump the collection, record and scoped tags of an inserted row', async () => {
        await dataSource.getRepository(RoleEntity).save({
            id: 'r1', 
            name: 'admin', 
            realmId: 'x', 
        });

        expect(calls).toEqual([
            ['role', 'role:r1', 'role:id=r1', 'role:realmId=x'],
        ]);
    });

    it('should bump old and new value of a scoped column on update', async () => {
        const repository = dataSource.getRepository(RoleEntity);
        await repository.save({
            id: 'r1', 
            name: 'admin', 
            realmId: 'x', 
        });
        calls = [];

        const role = await repository.findOneByOrFail({ id: 'r1' });
        role.realmId = 'y';
        await repository.save(role);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(expect.arrayContaining([
            'role',
            'role:r1',
            'role:realmId=x',
            'role:realmId=y',
        ]));
    });

    it('should bump the removed row and the collections cascading from it', async () => {
        await dataSource.getRepository(RoleEntity).save({
            id: 'r1', 
            name: 'admin', 
            realmId: 'x', 
        });
        await dataSource.getRepository(UserRoleEntity).save({
            id: 'ur1', 
            userId: 'u1', 
            roleId: 'r1', 
        });
        calls = [];

        const repository = dataSource.getRepository(RoleEntity);
        const role = await repository.findOneByOrFail({ id: 'r1' });
        await repository.remove(role);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(expect.arrayContaining([
            'role',
            'role:r1',
            'role:realmId=x',
            'userRole',
            'userRole:roleId=r1',
        ]));
    });

    it('should bump the role collection when a realm is removed', async () => {
        const repository = dataSource.getRepository(RealmEntity);
        const realm = await repository.findOneByOrFail({ id: 'x' });
        await repository.remove(realm);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(expect.arrayContaining([
            'realm',
            'realm:x',
            'role',
            'role:realmId=x',
        ]));
    });

    it('should bump the null scope of a SET NULL child when its parent is removed', async () => {
        const realm = await dataSource.getRepository(RealmEntity).findOneByOrFail({ id: 'x' });
        await dataSource.getRepository(RealmEntity).remove(realm);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(expect.arrayContaining([
            'note',
            'note:realmId=x',
            'note:realmId=null',
        ]));
    });

    it('should bump the collections the database cascades through transitively', async () => {
        await dataSource.getRepository(RoleEntity).save({
            id: 'r1',
            name: 'admin',
            realmId: 'x',
        });
        await dataSource.getRepository(UserRoleEntity).save({
            id: 'ur1',
            userId: 'u1',
            roleId: 'r1',
        });
        calls = [];

        const repository = dataSource.getRepository(RealmEntity);
        await repository.remove(await repository.findOneByOrFail({ id: 'x' }));

        // realm -> role CASCADE -> userRole CASCADE: only the realm hook
        // fires, and ur1 is gone.
        expect(await dataSource.getRepository(UserRoleEntity).count()).toEqual(0);
        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(expect.arrayContaining(['role', 'userRole']));
        // a grandchild's join column held a key that is not in hand.
        expect(calls[0]!.filter((tag) => tag.startsWith('userRole:'))).toEqual([]);
    });

    it('should bump both sides of a many-to-many link and unlink', async () => {
        await dataSource.getRepository(TagEntity).save({ id: 't1', name: 'news' });
        await dataSource.getRepository(ArticleEntity).save({ id: 'a1', title: 'hello' });
        calls = [];

        const articles = dataSource.getRepository(ArticleEntity);
        const article = await articles.findOneOrFail({ where: { id: 'a1' }, relations: { tags: true } });
        article.tags.push(await dataSource.getRepository(TagEntity).findOneByOrFail({ id: 't1' }));
        await articles.save(article);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(expect.arrayContaining(['article', 'article:a1', 'tag', 'tag:t1']));

        calls = [];
        article.tags = [];
        await articles.save(article);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(expect.arrayContaining(['article', 'article:a1', 'tag', 'tag:t1']));

        calls = [];
        const relation = dataSource.createQueryBuilder().relation(ArticleEntity, 'tags').of('a1');
        await relation.add('t1');

        expect(calls).toEqual([['article', 'article:a1', 'tag', 'tag:t1']]);

        // the query-builder unlink hands no join values: the collections.
        calls = [];
        await relation.remove('t1');

        expect(calls).toEqual([['article', 'tag']]);
    });

    it('should bump the row tags on a soft remove and on a recover', async () => {
        const repository = dataSource.getRepository(RoleEntity);
        await repository.save({
            id: 'r1', 
            name: 'admin', 
            realmId: 'x', 
        });
        calls = [];

        const role = await repository.findOneByOrFail({ id: 'r1' });
        await repository.softRemove(role);

        expect(await repository.findOneBy({ id: 'r1' })).toBeNull();
        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(expect.arrayContaining([
            'role',
            'role:r1',
            'role:realmId=x',
        ]));
        // an update of the delete-date column: nothing cascades in the database.
        expect(calls[0]).not.toContain('userRole');

        calls = [];
        await repository.recover(role);

        expect(await repository.findOneBy({ id: 'r1' })).not.toBeNull();
        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(expect.arrayContaining([
            'role',
            'role:r1',
            'role:realmId=x',
        ]));
    });

    it('should bump the collection tag alone for a criteria soft delete and restore', async () => {
        const repository = dataSource.getRepository(RoleEntity);
        await repository.save({
            id: 'r1', 
            name: 'admin', 
            realmId: 'x', 
        });
        calls = [];

        await repository.softDelete({ id: 'r1' });
        expect(calls).toEqual([['role']]);

        calls = [];
        await repository.restore({ id: 'r1' });
        expect(calls).toEqual([['role']]);
    });

    it('should bump the collection tag alone for a pk-less update', async () => {
        await dataSource.getRepository(RoleEntity).save({
            id: 'r1', 
            name: 'admin', 
            realmId: 'x', 
        });
        calls = [];

        await dataSource.getRepository(RoleEntity).update({ id: 'r1' }, { name: 'owner' });

        expect(calls).toEqual([['role']]);
    });

    it('should bump the collection and the cascading collections for a criteria delete', async () => {
        await dataSource.getRepository(RoleEntity).save({
            id: 'r1', 
            name: 'admin', 
            realmId: 'x', 
        });
        calls = [];

        await dataSource.getRepository(RoleEntity).delete({ id: 'r1' });

        expect(calls).toEqual([['role', 'userRole']]);
    });

    it('should invalidate once after the outermost commit only', async () => {
        await dataSource.transaction(async (manager) => {
            await manager.save(RoleEntity, {
                id: 'r1', 
                name: 'admin', 
                realmId: 'x', 
            });

            await manager.transaction(async (inner) => {
                await inner.save(UserRoleEntity, {
                    id: 'ur1', 
                    userId: 'u1', 
                    roleId: 'r1', 
                });
            });

            expect(calls).toHaveLength(0);
        });

        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(expect.arrayContaining([
            'role',
            'role:r1',
            'userRole',
            'userRole:ur1',
            'userRole:userId=u1',
            'userRole:roleId=r1',
        ]));
    });

    it('should bump nothing after a rollback', async () => {
        await expect(dataSource.transaction(async (manager) => {
            await manager.save(RoleEntity, {
                id: 'r1', 
                name: 'admin', 
                realmId: 'x', 
            });
            throw new Error('abort');
        })).rejects.toThrow('abort');

        expect(calls).toHaveLength(0);
    });

    it('should ignore an untracked table', async () => {
        const subscriber = new CacheInvalidationSubscriber({
            cache: { invalidate: async (tags) => { calls.push(tags); } },
            registry,
            resolveSchemaName: () => undefined,
        });

        const other = await createDataSource([subscriber]);
        try {
            await other.getRepository(RealmEntity).save({ id: 'z', name: 'other' });
        } finally {
            await other.destroy();
        }

        expect(calls).toHaveLength(0);
    });

    it('should report a failed invalidate and keep the write', async () => {
        failInvalidate = true;

        await dataSource.getRepository(RoleEntity).save({
            id: 'r1', 
            name: 'admin', 
            realmId: 'x', 
        });

        expect(errors).toHaveLength(1);
        expect((errors[0] as Error).message).toEqual('store unavailable');

        const role = await dataSource.getRepository(RoleEntity).findOneBy({ id: 'r1' });
        expect(role).not.toBeNull();
    });
});
