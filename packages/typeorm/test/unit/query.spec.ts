/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';
import { QueryVisitor } from '@rapiq/sql';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createUserSeed } from '../data/seeder/user';

describe('src/query', () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const [master] = await createRealmSeed(dataSource);
        const [, aston] = await createUserSeed(dataSource);

        aston.realm = master;
        await dataSource.getRepository(User).save(aston);
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

        const adapter = new TypeormAdapter({ relations: { joinAndSelect: true } });
        adapter.withQuery(queryBuilder);
        query.accept(new QueryVisitor(adapter));
        adapter.execute();

        const sql = queryBuilder.getSql();
        expect(sql).toContain('JOIN');
        expect(sql).toContain('ORDER BY');

        const entities = await queryBuilder.getMany();
        expect(entities.length).toBeGreaterThan(0);
        for (let i = 0; i < entities.length; i++) {
            expect(entities[i].age).toBeGreaterThanOrEqual(18);
        }
    });
});
