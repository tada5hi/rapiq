/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { DataSource, Repository } from 'typeorm';
import { Interpreter } from '@rapiq/sql';
import { Relation, Relations } from 'rapiq';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createRoleSeed } from '../data/seeder/role';
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

        const [admin] = await createRoleSeed(dataSource);
        const roleRepository = dataSource.getRepository(Role);
        admin.realm = master;
        await roleRepository.save(admin);

        const [, aston] = await createUserSeed(dataSource);
        userRepository = dataSource.getRepository(User);
        aston.role = admin;
        aston.realm = master;

        await userRepository.save(aston);
    });

    const adapter = new TypeormAdapter({
        relations: {
            joinAndSelect: true,
        },
    });
    const interpreter = new Interpreter();

    const createQueryBuilder = (relations: Relations) => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        adapter.withQuery(queryBuilder);

        interpreter.interpret({ relations }, adapter, {});

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
});
