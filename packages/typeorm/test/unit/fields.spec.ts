/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { DataSource, Repository } from 'typeorm';
import { FieldsVisitor } from '@rapiq/sql';
import { Field, Fields } from '@rapiq/core';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createRoleSeed } from '../data/seeder/role';
import { Role } from '../data/entity/role';
import { createUserSeed } from '../data/seeder/user';
import { User } from '../data/entity/user';
import { TypeormAdapter } from '../../src';

const getKeysOfMany = (entities: Record<string, any>[]) => {
    const [entity] = entities;
    if (!entity) {
        return [];
    }

    return Object.keys(entity).filter((key) => !!entity[key]);
};

describe('src/fields', () => {
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

    const createQueryBuilder = (fields: Fields) => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        const adapter = new TypeormAdapter();
        adapter.withQuery(queryBuilder);
        const visitor = new FieldsVisitor(adapter.fields);
        fields.accept(visitor);

        adapter.execute();

        return queryBuilder;
    };

    it('should select sparse fieldset', async () => {
        const queryBuilder = createQueryBuilder(
            new Fields([
                new Field('id'),
                new Field('first_name'),
                new Field('last_name'),
            ]),
        );

        const entities = await queryBuilder.getMany();

        const keys = getKeysOfMany(entities);

        expect(keys).toHaveLength(3);
        expect(keys).toEqual(['id', 'first_name', 'last_name']);
    });
});
