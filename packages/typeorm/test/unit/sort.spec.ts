/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { DataSource, Repository } from 'typeorm';
import { Interpreter } from '@rapiq/sql';
import type { SortParseOutput } from 'rapiq';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createRoleSeed } from '../data/seeder/role';
import { Role } from '../data/entity/role';
import { createUserSeed } from '../data/seeder/user';
import { User } from '../data/entity/user';
import { TypeormAdapter } from '../../src';

describe('src/sort', () => {
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

    const adapter = new TypeormAdapter();
    const interpreter = new Interpreter();

    const createQueryBuilder = (sort: SortParseOutput) => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        adapter.withQuery(queryBuilder);

        interpreter.interpret({ sort }, adapter, {});

        return queryBuilder;
    };

    it('should sort by last name', async () => {
        const queryOne = createQueryBuilder({
            last_name: 'ASC',
        });

        const [queryOneFirst] = await queryOne.getMany();
        expect(queryOneFirst).toBeDefined();

        const queryTwo = createQueryBuilder({
            last_name: 'DESC',
        });

        const [queryTwoFirst] = await queryTwo.getMany();
        expect(queryTwoFirst).toBeDefined();

        expect(queryOneFirst).not.toEqual(queryTwoFirst);
    });
});
