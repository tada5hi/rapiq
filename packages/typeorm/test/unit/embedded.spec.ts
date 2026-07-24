/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Filter,
    FilterFieldOperator,
    Filters,
    Query,
    Relation,
    Relations,
    Sort,
    Sorts,
} from '@rapiq/core';
import { buildRelationAlias } from '@rapiq/sql';
import type { DataSource, SelectQueryBuilder } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { Profile } from '../data/entity/profile';
import { Role } from '../data/entity/role';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createRoleSeed } from '../data/seeder/role';
import { createUserSeed } from '../data/seeder/user';

describe('src/adapter (embedded columns)', () => {
    let dataSource : DataSource;
    let userDatabaseName : string;
    let roleDatabaseName : string;

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        await createRealmSeed(dataSource);

        const [admin] = await createRoleSeed(dataSource);
        const roleRepository = dataSource.getRepository(Role);
        admin.profile = new Profile();
        admin.profile.firstName = 'Ada';
        admin.profile.lastName = 'Lovelace';
        await roleRepository.save(admin);

        const [, aston] = await createUserSeed(dataSource);
        const userRepository = dataSource.getRepository(User);
        aston.role = admin;
        aston.profile = new Profile();
        aston.profile.firstName = 'Padme';
        aston.profile.lastName = 'Amidala';
        await userRepository.save(aston);

        // the database identifier typeorm derives for the embedded columns
        // (e.g. `profileFirstname`) — asserted against, not hardcoded.
        userDatabaseName = dataSource.getMetadata(User)
            .findColumnWithPropertyPath('profile.firstName')!.databaseName;
        roleDatabaseName = dataSource.getMetadata(Role)
            .findColumnWithPropertyPath('profile.firstName')!.databaseName;
    });

    const createQueryBuilder = (query: Query) : SelectQueryBuilder<User> => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder });
        adapter.execute(query);

        return queryBuilder;
    };

    it('should answer isRelationPath from entity metadata', () => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder });

        expect(adapter.relations.isRelationPath('role')).toBeTruthy();
        expect(adapter.relations.isRelationPath('role.realm')).toBeTruthy();

        expect(adapter.relations.isRelationPath('profile')).toBeFalsy();
        expect(adapter.relations.isRelationPath('role.profile')).toBeFalsy();
        expect(adapter.relations.isRelationPath('unknown')).toBeFalsy();
    });

    it('should filter an embedded column against the root alias without joining', async () => {
        const queryBuilder = createQueryBuilder(new Query({
            filters: new Filters('and', [
                new Filter(FilterFieldOperator.EQUAL, 'profile.firstName', 'Padme'),
            ]),
        }));

        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(0);
        expect(queryBuilder.getSql()).toContain(`"user"."${userDatabaseName}"`);

        const data = await queryBuilder.getMany();

        expect(data).toHaveLength(1);
        expect(data[0].first_name).toEqual('Aston');
        expect(data[0].profile.firstName).toEqual('Padme');
    });

    it('should filter an embedded column behind a relation against the relation alias', async () => {
        const queryBuilder = createQueryBuilder(new Query({
            filters: new Filters('and', [
                new Filter(FilterFieldOperator.EQUAL, 'role.profile.firstName', 'Ada'),
            ]),
        }));

        // only the real relation joins — the embedded prefix does not.
        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(1);
        expect(queryBuilder.getSql()).toContain(
            `"${buildRelationAlias('role')}"."${roleDatabaseName}"`,
        );

        const data = await queryBuilder.getMany();

        expect(data).toHaveLength(1);
        expect(data[0].first_name).toEqual('Aston');
    });

    it('should sort by an embedded column without joining', async () => {
        const queryBuilder = createQueryBuilder(
            new Query({ sorts: new Sorts([new Sort('profile.firstName', 'DESC')]) }),
        );

        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(0);
        expect(queryBuilder.getSql()).toContain(
            `ORDER BY "user"."${userDatabaseName}" DESC`,
        );

        const data = await queryBuilder.getMany();

        expect(data).toHaveLength(2);
        expect(data[0].profile.firstName).toEqual('Padme');
    });

    it('should select an embedded column without joining', async () => {
        const queryBuilder = createQueryBuilder(new Query({
            fields: new Fields([
                new Field('id'),
                new Field('profile.firstName'),
            ]),
        }));

        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(0);
        expect(queryBuilder.getSql()).toContain(`"user"."${userDatabaseName}"`);

        const data = await queryBuilder.getMany();

        expect(data).toHaveLength(2);

        const aston = data.find((user) => user.profile?.firstName === 'Padme');
        expect(aston).toBeDefined();
        expect(aston!.first_name).toBeUndefined();
    });

    it('should still join a real relation dotted path', async () => {
        const queryBuilder = createQueryBuilder(new Query({
            filters: new Filters('and', [
                new Filter(FilterFieldOperator.EQUAL, 'role.realm.name', 'master'),
            ]),
        }));

        const aliases = queryBuilder.expressionMap.joinAttributes.map(
            (attribute) => attribute.alias.name,
        );

        expect(aliases).toEqual([
            buildRelationAlias('role'),
            buildRelationAlias('role.realm'),
        ]);
    });

    it('should project an included relation once when a dotted embedded column behind it is selected (#831)', async () => {
        // `role.profile.firstName` behind an included `role` builds the column
        // string `<roleAlias>.profile.firstName` — a dotted embedded path. The
        // join alias is the FIRST segment; the fields adapter must recognize it
        // and drop the column, because `role` is join-and-selected as a whole
        // subtree. Splitting on the last dot would keep it and re-project the
        // embedded column, duplicating its output alias (MySQL rejects it).
        const queryBuilder = createQueryBuilder(new Query({
            fields: new Fields([new Field('id'), new Field('role.profile.firstName')]),
            relations: new Relations([new Relation('role')]),
        }));

        const aliases = [...queryBuilder.getSql().matchAll(/AS\s+"([^"]+)"/g)].map((m) => m[1]);
        const duplicates = aliases.filter((alias, index) => aliases.indexOf(alias) !== index);
        expect(duplicates).toEqual([]);

        // the included relation still hydrates as a whole subtree
        const data = await queryBuilder.getMany();
        const aston = data.find((user) => !!user.role);
        expect(aston).toBeDefined();
        expect(aston!.role.profile.firstName).toEqual('Ada');
    });
});
