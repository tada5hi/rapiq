/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { DataSource, Repository } from 'typeorm';
import { Query, Relation, Relations } from '@rapiq/core';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createRoleSeed } from '../data/seeder/role';
import { Realm } from '../data/entity/realm';
import { Role } from '../data/entity/role';
import { createUserSeed } from '../data/seeder/user';
import { User } from '../data/entity/user';
import { TypeormAdapter } from '../../src';

describe('src/relations', () => {
    let dataSource: DataSource;
    let userRepository : Repository<User>;

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const [master] = await createRealmSeed(dataSource);
        // a second realm on the role branch — distinct data on `realm`
        // vs `role.realm` exposes join-alias collisions (#744).
        const realmRepository = dataSource.getRepository(Realm);
        const other = await realmRepository.save({ name: 'other' });

        const [admin] = await createRoleSeed(dataSource);
        const roleRepository = dataSource.getRepository(Role);
        admin.realm = other;
        await roleRepository.save(admin);

        const [, aston] = await createUserSeed(dataSource);
        userRepository = dataSource.getRepository(User);
        aston.role = admin;
        aston.realm = master;

        await userRepository.save(aston);
    });

    const createQueryBuilder = (relations: Relations) => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder, relations: { joinAndSelect: true } });
        adapter.execute(new Query({ relations }));

        return queryBuilder;
    };

    it('should include relation', async () => {
        const queryOne = createQueryBuilder(new Relations([
            new Relation('role'),
        ]));

        const user = await queryOne.getOneOrFail();

        expect(user.role).toBeDefined();
        expect(user.realm).toBeUndefined();
    });

    it('should include multiple relations', async () => {
        const queryOne = createQueryBuilder(new Relations([
            new Relation('realm'),
            new Relation('role'),
        ]));

        const user = await queryOne.getOneOrFail();

        expect(user.role).toBeDefined();
        expect(user.realm).toBeDefined();
    });

    it('should include same-named relations on different branches', async () => {
        const queryBuilder = createQueryBuilder(new Relations([
            new Relation('realm'),
            new Relation('role.realm'),
        ]));

        const users = await queryBuilder.getMany();
        const user = users.find((element) => !!element.role);

        expect(user).toBeDefined();
        expect(user?.realm.name).toEqual('master');
        expect(user?.role.realm.name).toEqual('other');
    });
});
