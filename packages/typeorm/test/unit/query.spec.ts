/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createUserSeed } from '../data/seeder/user';

describe('src/query', () => {
    let dataSource : DataSource;
    let masterRealmId : number;

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const [master] = await createRealmSeed(dataSource);
        const [, aston] = await createUserSeed(dataSource);

        aston.realm = master;
        await dataSource.getRepository(User).save(aston);

        masterRealmId = master.id;
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('should apply a full parsed query', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'realm',
            fields: { allowed: ['id', 'name'] },
        }));
        registry.add(defineSchema({
            name: 'user',
            schemaMapping: { realm: 'realm' },
            fields: { allowed: ['id', 'first_name', 'age'] },
            filters: { allowed: ['id', 'first_name', 'age'] },
            relations: { allowed: ['realm'] },
            sort: { allowed: ['id', 'age'] },
            pagination: { maxLimit: 50 },
        }));

        const parser = new SimpleParser(registry);
        const query = parser.parse({
            fields: ['id', 'first_name', 'age'],
            filters: { age: '>=18' },
            relations: ['realm'],
            sort: '-age',
            pagination: { limit: 25 },
        }, { schema: 'user' });

        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder, relations: { joinAndSelect: true } });
        adapter.execute(query);

        const sql = queryBuilder.getSql();
        expect(sql).toContain('JOIN');
        expect(sql).toContain('ORDER BY');

        const entities = await queryBuilder.getMany();
        expect(entities.length).toBeGreaterThan(0);
        for (const entity of entities) {
            expect(entity.age).toBeGreaterThanOrEqual(18);
        }
    });

    it('should apply an authup-style repository query', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'user',
            filters: { allowed: ['id', 'realm_id'] },
            relations: { allowed: ['role'] },
            pagination: { maxLimit: 10 },
        }));

        const parser = new SimpleParser(registry);

        // realm scoping: match records of a realm *or* without one;
        // requested limit exceeds maxLimit and is clamped.
        const query = parser.parse({
            filters: { realm_id: [`${masterRealmId}`, 'null'] },
            relations: ['role'],
            pagination: { limit: 50 },
        }, { schema: 'user' });

        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');
        queryBuilder.groupBy('user.id');

        const adapter = new TypeormAdapter({
            queryBuilder,
            relations: {
                joinAndSelect: true,
                onJoin: (path, alias, join) => {
                    join.addGroupBy(`${alias}.id`);
                },
            },
        });

        const { pagination } = adapter.execute(query);
        expect(pagination.limit).toEqual(10);

        const sql = queryBuilder.getSql();
        expect(sql).toContain('LEFT JOIN');
        expect(sql).toContain('GROUP BY');

        // aston (realm master) + caleb (no realm) both match
        const entities = await queryBuilder.getMany();
        expect(entities.length).toEqual(2);
    });
});
