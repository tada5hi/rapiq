/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    ErrorCode,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    ITSELF,
    Query,
} from '@rapiq/core';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { User } from '../data/entity/user';
import { Role } from '../data/entity/role';
import { RoleDetail } from '../data/entity/role-detail';
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

        const filters = condition instanceof Filters ?
            condition :
            new Filters(FilterCompoundOperator.AND, [condition]);

        const adapter = new TypeormAdapter({ queryBuilder });
        adapter.execute(new Query({ filters }));

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

    // complement law: negated operators match rows where the filtered
    // column is NULL (Aston has no address, Caleb lives at 'Hogwarts').
    it('should match a NULL row with not eq', async () => {
        const condition = new Filter(
            FilterFieldOperator.NOT_EQUAL,
            'address',
            'Hogwarts',
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;
        expect(user.first_name).toEqual('Aston');
    });

    it('should match a NULL row with nin', async () => {
        const condition = new Filter(
            FilterFieldOperator.NOT_IN,
            'address',
            ['Hogwarts', 'Mordor'],
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;
        expect(user.first_name).toEqual('Aston');
    });

    it('should match a NULL row with notContains, but not with contains', async () => {
        const negated = new Filter(
            FilterFieldOperator.NOT_CONTAINS,
            'address',
            'wart',
        );

        const negatedData = await createQueryBuilder(negated).getMany();

        expect(negatedData.length).toEqual(1);
        expect(negatedData[0].first_name).toEqual('Aston');

        const positive = new Filter(
            FilterFieldOperator.CONTAINS,
            'address',
            'wart',
        );

        const positiveData = await createQueryBuilder(positive).getMany();

        expect(positiveData.length).toEqual(1);
        expect(positiveData[0].first_name).toEqual('Caleb');
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

    it('should throw typed on a size condition', () => {
        // no SQL rendering yet (mirrors @rapiq/sql).
        const condition = new Filter(
            FilterFieldOperator.SIZE,
            'first_name',
            2,
        );

        try {
            createQueryBuilder(condition);
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(AdapterError);
            expect((e as AdapterError).code).toEqual(ErrorCode.FEATURE_UNSUPPORTED);
        }
    });

    it('should throw typed on an ITSELF leaf', () => {
        // a joined relation row is not a scalar column — no rendering
        // for the element itself (mirrors @rapiq/sql).
        const condition = new Filter(
            FilterFieldOperator.ELEM_MATCH,
            'role',
            new Filter(FilterFieldOperator.EQUAL, ITSELF, 'admin'),
        );

        try {
            createQueryBuilder(condition);
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(AdapterError);
            expect((e as AdapterError).code).toEqual(ErrorCode.FEATURE_UNSUPPORTED);
        }
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

    it('should match string equality case-insensitively', async () => {
        const condition = new Filter(
            FilterFieldOperator.EQUAL,
            'first_name',
            'ASTON',
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;

        expect(user.first_name).toEqual('Aston');
    });

    it('should keep fields listed in caseSensitive exact', async () => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder });
        adapter.execute(
            new Query({
                filters: new Filters(FilterCompoundOperator.AND, [
                    new Filter(FilterFieldOperator.EQUAL, 'first_name', 'ASTON'),
                ]),
            }),
            { visitor: { caseSensitive: ['first_name'] } },
        );

        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(0);
    });

    it('should case-fold only string-typed columns', () => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder });

        expect(adapter.filters.isCaseFoldable('first_name')).toBeTruthy();
        expect(adapter.filters.isCaseFoldable('role.realm.name')).toBeTruthy();

        expect(adapter.filters.isCaseFoldable('age')).toBeFalsy();
        expect(adapter.filters.isCaseFoldable('role_id')).toBeFalsy();

        // unresolvable paths keep the folding default
        expect(adapter.filters.isCaseFoldable('unknown.path')).toBeTruthy();
    });

    it('should not case-fold a non-string column filtered with a wire string', async () => {
        // the wire is untyped — '18' may reach an int column as a string.
        // lower(int) is a type error on postgres; the column type exempts it.
        const condition = new Filter(FilterFieldOperator.EQUAL, 'age', '18');

        const queryBuilder = createQueryBuilder(condition);

        expect(queryBuilder.getQuery()).not.toContain('lower(');

        // the database still coerces the comparison by column affinity
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);

        const [user] = data;

        expect(user.first_name).toEqual('Caleb');
    });

    it('should resolve property names to database column names', async () => {
        // nickName is stored as nick_name — WHERE fragments are raw SQL,
        // so the adapter must map the property path itself (typeorm >= 1.x
        // no longer rewrites property names in select query builders).
        const condition = new Filter(
            FilterFieldOperator.EQUAL,
            'nickName',
            'Ash',
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
        expect(data[0].nickName).toEqual('Ash');
    });

    it('should resolve nested relation property names to database column names', async () => {
        // role.detail.internalNote descends two relation hops and is
        // stored as internal_note.
        const detailRepository = dataSource.getRepository(RoleDetail);
        const detail = await detailRepository.save(
            detailRepository.create({ internalNote: 'restricted' }),
        );

        const roleRepository = dataSource.getRepository(Role);
        const admin = await roleRepository.findOneByOrFail({ name: 'admin' });
        admin.detail = detail;
        await roleRepository.save(admin);

        const condition = new Filter(
            FilterFieldOperator.EQUAL,
            'role.detail.internalNote',
            'restricted',
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
        expect(data[0].first_name).toEqual('Aston');
    });

    it('should resolve relation property names to database column names', async () => {
        // role.displayName is stored as role.display_name.
        const condition = new Filter(
            FilterFieldOperator.EQUAL,
            'role.displayName',
            'Administrator',
        );

        const queryBuilder = createQueryBuilder(condition);
        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
        expect(data[0].first_name).toEqual('Aston');
    });
});
