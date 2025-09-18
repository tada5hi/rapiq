/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Interpreter,
} from '@rapiq/sql';
import type { FiltersParseOutput } from 'rapiq';
import {
    CompoundCondition, FieldCondition, FilterCompoundOperator, FilterFieldOperator,
} from 'rapiq';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { User } from '../data/entity/user';
import { Role } from '../data/entity/role';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createRoleSeed } from '../data/seeder/role';
import { createUserSeed } from '../data/seeder/user';

describe('src', () => {
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

    const adapter = new TypeormAdapter();
    const interpreter = new Interpreter();

    const createQueryBuilder = (condition: FiltersParseOutput) => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        adapter.withQuery(queryBuilder);

        interpreter.interpret({ filters: condition }, adapter, {});

        return queryBuilder;
    };

    it('should work with eq', async () => {
        const condition = new FieldCondition(
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
        const condition = new FieldCondition(
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
        const condition = new FieldCondition(
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
        const condition = new FieldCondition(
            FilterFieldOperator.GREATER_THAN_EQUAL,
            'age',
            18,
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(2);
    });

    it('should work with lessThan', async () => {
        const condition = new FieldCondition(
            FilterFieldOperator.LESS_THAN,
            'age',
            60,
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });

    it('should work with lessThanEqual', async () => {
        const condition = new FieldCondition(
            FilterFieldOperator.LESS_THAN_EQUAL,
            'age',
            60,
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(2);
    });

    it('should work with mod', async () => {
        const condition = new FieldCondition(
            FilterFieldOperator.MOD,
            'age',
            [20, 0],
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });

    it('should work with exists', async () => {
        const condition = new FieldCondition(
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
        const condition = new FieldCondition(
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
        const condition = new FieldCondition(
            FilterFieldOperator.IN,
            'age',
            [20, 60],
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });

    it('should work with nin', async () => {
        const condition = new FieldCondition(
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

    it('work with compound and (eq + within)', async () => {
        const condition = new CompoundCondition(
            FilterCompoundOperator.AND,
            [
                new FieldCondition(FilterFieldOperator.EQUAL, 'first_name', 'Caleb'),
                new FieldCondition(FilterFieldOperator.WITHIN, 'age', [18, 20]),
            ],
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;
        expect(user.first_name).toEqual('Caleb');
    });

    it('should work with compound or (eq + within)', async () => {
        const condition = new CompoundCondition(
            FilterCompoundOperator.OR,
            [
                new FieldCondition(FilterFieldOperator.EQUAL, 'address', 'Hogwarts'),
                new FieldCondition(FilterFieldOperator.WITHIN, 'age', [60]),
            ],
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(2);
    });

    it('should work with elemMatch', async () => {
        const condition = new FieldCondition(
            FilterFieldOperator.ELEM_MATCH,
            'role',
            new FieldCondition(FilterFieldOperator.EQUAL, 'name', 'admin'),
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });

    it('should work with deep relation', async () => {
        const condition = new FieldCondition(
            FilterFieldOperator.EQUAL,
            'role.realm.name',
            'master',
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });
});
