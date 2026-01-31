/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FiltersVisitor,
} from '@rapiq/sql';
import {
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
} from '@rapiq/core';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { User } from '../data/entity/user';
import { Role } from '../data/entity/role';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createRoleSeed } from '../data/seeder/role';
import { createUserSeed } from '../data/seeder/user';

describe('src/filters', () => {
    let dataSource : DataSource;

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
        const userRepository = dataSource.getRepository(User);
        aston.role = admin;
        aston.realm = master;

        await userRepository.save(aston);
    });

    const createQueryBuilder = (condition: Filter | Filters) => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        const adapter = new TypeormAdapter();
        adapter.withQuery(queryBuilder);
        const visitor = new FiltersVisitor(adapter.filters);
        condition.accept(visitor);

        adapter.execute();

        return queryBuilder;
    };

    it('should work with eq', async () => {
        const condition = new Filter(
            FilterFieldOperator.EQUAL,
            'first_name',
            'Aston',
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;

        expect(user.first_name).toEqual('Aston');
    });

    it('should work with not eq', async () => {
        const condition = new Filter(
            FilterFieldOperator.NOT_EQUAL,
            'first_name',
            'Aston',
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;

        expect(user.first_name).toEqual('Caleb');
    });

    it('should work with greaterThan', async () => {
        const condition = new Filter(
            FilterFieldOperator.GREATER_THAN,
            'age',
            18,
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;

        expect(user.first_name).toEqual('Aston');
    });

    it('should work with greaterThanEqual', async () => {
        const condition = new Filter(
            FilterFieldOperator.GREATER_THAN_EQUAL,
            'age',
            18,
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(2);
    });

    it('should work with lessThan', async () => {
        const condition = new Filter(
            FilterFieldOperator.LESS_THAN,
            'age',
            60,
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });

    it('should work with lessThanEqual', async () => {
        const condition = new Filter(
            FilterFieldOperator.LESS_THAN_EQUAL,
            'age',
            60,
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(2);
    });

    it('should work with mod', async () => {
        const condition = new Filter(
            FilterFieldOperator.MOD,
            'age',
            [20, 0],
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });

    it('should work with exists', async () => {
        const condition = new Filter(
            FilterFieldOperator.EXISTS,
            'address',
            true,
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;
        expect(user.first_name).toEqual('Caleb');
    });

    it('should work with not exists', async () => {
        const condition = new Filter(
            FilterFieldOperator.EXISTS,
            'address',
            false,
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;
        expect(user.first_name).toEqual('Aston');
    });

    it('should work with in', async () => {
        const condition = new Filter(
            FilterFieldOperator.IN,
            'age',
            [20, 60],
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });

    it('should work with nin', async () => {
        const condition = new Filter(
            FilterFieldOperator.NOT_IN,
            'age',
            [20, 60],
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;
        expect(user.first_name).toEqual('Caleb');
    });

    it('work with compound and (eq + in)', async () => {
        const condition = new Filters(
            FilterCompoundOperator.AND,
            [
                new Filter(FilterFieldOperator.EQUAL, 'first_name', 'Caleb'),
                new Filter(FilterFieldOperator.IN, 'age', [18, 20]),
            ],
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;
        expect(user.first_name).toEqual('Caleb');
    });

    it('should work with compound or (eq + in)', async () => {
        const condition = new Filters(
            FilterCompoundOperator.OR,
            [
                new Filter(FilterFieldOperator.EQUAL, 'address', 'Hogwarts'),
                new Filter(FilterFieldOperator.IN, 'age', [60]),
            ],
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(2);
    });

    it('should work with elemMatch', async () => {
        const condition = new Filter(
            FilterFieldOperator.ELEM_MATCH,
            'role',
            new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });

    it('should work with deep relation', async () => {
        const condition = new Filter(
            FilterFieldOperator.EQUAL,
            'role.realm.name',
            'master',
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });
});
