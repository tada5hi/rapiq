/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { DataSource } from 'typeorm';
import {
    Field, 
    Fields, 
    Query, 
    Relation, 
    Relations,
} from '@rapiq/core';
import { TypeormAdapter } from '../../src';
import { Role } from '../data/entity/role';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createRoleSeed } from '../data/seeder/role';
import { createUserSeed } from '../data/seeder/user';

/**
 * Executing regression for #831 against a live database (the CI `tests-db`
 * matrix runs this suite on MySQL and postgres; locally it runs on sqlite).
 *
 * The junction/authup pattern groups the root by its id and includes a
 * relation. Before the fix, the relation's columns were projected twice (once
 * via the explicit `select()`, once via `leftJoinAndSelect`), which MySQL
 * rejects with `Duplicate column name` once GROUP BY materializes a temporary
 * table. sqlite and postgres tolerate the duplicate output alias, so this only
 * goes red on the MySQL leg — exactly why the beta.7 -> beta.8 regression
 * slipped a sqlite-only suite.
 */
describe('issue #831', () => {
    let dataSource: DataSource;

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

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('projects an included relation exactly once under GROUP BY <root>.id', async () => {
        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');
        queryBuilder.groupBy('user.id');

        new TypeormAdapter({
            queryBuilder,
            relations: {
                // mirror the authup junction adapter: keep every joined relation
                // groupable so postgres' functional-dependency check is satisfied
                // and the query isolates the #831 duplicate-alias failure to MySQL.
                onJoin: (_path, alias, builder) => {
                    if (builder.expressionMap.groupBys.length > 0) {
                        builder.addGroupBy(`${alias}.id`);
                    }
                },
            },
        }).execute(new Query({
            fields: new Fields([new Field('id'), new Field('role.id')]),
            relations: new Relations([new Relation('role')]),
        }));

        // getMany() (not getSql()) is required: the duplicate only errors when
        // the live engine materializes the grouped result.
        const users = await queryBuilder.getMany();

        expect(users.length).toBeGreaterThan(0);
        expect(users.some((user) => !!user.role)).toBe(true);
    });

    it('emits no duplicate output alias for an included relation', () => {
        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

        new TypeormAdapter({ queryBuilder }).execute(new Query({
            fields: new Fields([new Field('id'), new Field('role.id')]),
            relations: new Relations([new Relation('role')]),
        }));

        const aliases = [...queryBuilder.getSql().matchAll(/AS\s+"([^"]+)"/g)].map((m) => m[1]);
        const duplicates = aliases.filter((alias, index) => aliases.indexOf(alias) !== index);
        expect(duplicates).toEqual([]);
    });
});
