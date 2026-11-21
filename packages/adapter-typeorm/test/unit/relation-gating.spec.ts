/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createURLCodec } from '@rapiq/codec-url';
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { Realm } from '../data/entity/realm';
import { Role } from '../data/entity/role';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';

/**
 * #1001: a filter through relation `realm` is gated by the schema
 * (filters.relations), not by the include. The adapter joins `realm`
 * to filter, but only hydrates what `include` names.
 */
describe('relation traversal gating (#1001)', () => {
    let dataSource : DataSource;

    const registry = new SchemaRegistry();

    registry.add(defineSchema<User>({
        name: 'user',
        fields: { allowed: ['id', 'first_name'] },
        filters: { allowed: ['id', 'realm.name'] },
        relations: { allowed: ['role', 'realm'] },
        sort: { allowed: ['id'] },
        schemaMapping: { realm: 'realm', role: 'role' },
    }));
    registry.add(defineSchema<Realm>({
        name: 'realm',
        fields: { allowed: ['id', 'name'] },
        filters: { allowed: ['id', 'name'] },
    }));
    registry.add(defineSchema<Role>({
        name: 'role',
        fields: { allowed: ['id', 'name'] },
        filters: { allowed: ['id', 'name'] },
    }));

    const codec = createURLCodec(registry);

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const realms = await dataSource.getRepository(Realm).save([
            { name: 'master' },
            { name: 'other' },
        ]);
        const role = await dataSource.getRepository(Role).save({ name: 'admin' });

        await dataSource.getRepository(User).save([
            {
                first_name: 'Caleb', 
                last_name: 'Barrows', 
                age: 18, 
                email: 'a@x.io', 
                realm: realms[0], 
                role,
            },
            {
                first_name: 'Aston', 
                last_name: 'Nel', 
                age: 60, 
                email: 'b@x.io', 
                realm: realms[1], 
                role,
            },
            {
                first_name: 'Marta', 
                last_name: 'Nel', 
                age: 30, 
                email: 'c@x.io', 
                realm: realms[0], 
                role,
            },
        ]);
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    const run = async (input: Record<string, any>) => {
        const query = codec.decode(input, { schema: 'user' });

        expect(query).toBeDefined();

        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');
        const adapter = new TypeormAdapter({ queryBuilder });

        adapter.execute(query!);

        return queryBuilder.getMany();
    };

    it('filters through a relation that is not the included one', async () => {
        const users = await run({
            filter: { 'realm.name': 'master' },
            include: 'role',
            sort: 'id',
        });

        expect(users.map((user) => user.first_name)).toEqual(['Caleb', 'Marta']);
        expect(users.every((user) => !!user.role)).toBe(true);
        expect(users.every((user) => user.realm === undefined)).toBe(true);
    });

    it('filters through a relation without any include', async () => {
        const users = await run({ filter: { 'realm.name': 'other' } });

        expect(users.map((user) => user.first_name)).toEqual(['Aston']);
        expect(users[0].realm).toBeUndefined();
        expect(users[0].role).toBeUndefined();
    });
});
