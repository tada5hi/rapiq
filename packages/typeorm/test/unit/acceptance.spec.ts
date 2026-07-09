/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLDecoder } from '@rapiq/codec-url-simple';
import {
    Query, 
    SchemaRegistry, 
    defineSchema, 
    eq,
} from '@rapiq/core';
import type { Schema } from '@rapiq/core';
import type { DataSource, SelectQueryBuilder } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createRoleSeed } from '../data/seeder/role';
import { createUserSeed } from '../data/seeder/user';

/**
 * M2 gate (roadmap 000): an authup-style repository ports to v2
 * with identical SQL behavior. The v1 shape being ported:
 *
 * applyQuery(queryBuilder, useRequestQuery(req), {
 *     defaultAlias: 'user',
 *     fields: { default: [...], allowed: ['email'] },
 *     filters: { allowed: [...] },
 *     pagination: { maxLimit: 50 },
 *     relations: { allowed: ['role'], onJoin: (_, alias) => qb.addGroupBy(`${alias}.id`) },
 *     sort: { allowed: [...] },
 * });
 */
function createUserRepository(schema: Schema<User>) {
    const registry = new SchemaRegistry();
    registry.add(schema);

    const decoder = new URLDecoder(registry);

    return {
        applyQuery(
            queryBuilder: SelectQueryBuilder<User>,
            input: string | Record<string, any>,
        ) {
            const query = decoder.decode(input, { schema: 'user' });
            expect(query).toBeDefined();

            const adapter = new TypeormAdapter({
                queryBuilder,
                relations: {
                    joinAndSelect: true,
                    onJoin: (_path, alias, join) => {
                        join.addGroupBy(`${alias}.id`);
                    },
                },
            });

            return adapter.execute(query!);
        },
    };
}

describe('acceptance: authup-style repository port (M2 gate)', () => {
    let dataSource : DataSource;
    let masterRealmId : number;

    const repository = createUserRepository(defineSchema<User>({
        name: 'user',
        fields: {
            default: ['id', 'first_name', 'last_name', 'age'],
            allowed: ['email'],
        },
        filters: { allowed: ['id', 'first_name', 'realm_id'] },
        pagination: { maxLimit: 50 },
        relations: { allowed: ['role'] },
        sort: { allowed: ['id', 'age', 'first_name'] },
    }));

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const [master] = await createRealmSeed(dataSource);
        const [admin] = await createRoleSeed(dataSource);
        const [, aston] = await createUserSeed(dataSource);

        aston.realm = master;
        aston.role = admin;
        await dataSource.getRepository(User).save(aston);

        masterRealmId = master.id;
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('should port the realm-scoped list query with identical sql semantics', async () => {
        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');
        queryBuilder.groupBy('user.id');

        // wire input as sent by the client:
        // realm scoping (records of a realm *or* without one),
        // sensitive-field opt-in (+email), limit above maxLimit.
        const output = repository.applyQuery(
            queryBuilder,
            `fields=%2Bemail&filter[realm_id]=${masterRealmId},null&include=role&sort=-age&page[limit]=100`,
        );

        // requested limit is clamped to maxLimit and echoed for response meta
        expect(output.pagination).toEqual({ limit: 50, offset: 0 });

        // the sqlite driver inlines numeric parameters
        const sql = queryBuilder.getSql();

        // null-aware in condition: (key IN (...) OR key IS NULL)
        expect(sql).toContain(`("user"."realm_id" in(${masterRealmId}) or "user"."realm_id" is null)`);

        // relations join left (not inner) and honor the groupBy hook
        expect(sql).toContain('LEFT JOIN');
        expect(sql).not.toContain('INNER JOIN');
        expect(sql).toContain('GROUP BY "user"."id", "role"."id"');

        // email is selected only because the client opted in
        expect(sql).toContain('"user"."email"');
        expect(sql).not.toContain('"user"."address"');

        expect(sql).toContain('ORDER BY "user_age" DESC');

        // aston (realm master, role admin) + caleb (no realm, no role):
        // the left join keeps caleb, the null-aware filter matches both
        const entities = await queryBuilder.getMany();
        expect(entities.length).toEqual(2);
        expect(entities[0].first_name).toEqual('Aston');
        expect(entities[0].email).toEqual('ashton.nel@gmail.com');
        expect(entities[1].first_name).toEqual('Caleb');
    });

    it('should hide sensitive fields by default and drop undeclared input', async () => {
        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

        // express-style req.query object; neither the age filter
        // nor the email sort is allow-listed.
        const output = repository.applyQuery(queryBuilder, {
            filter: { age: '18' },
            sort: '-email',
        });

        // maxLimit applies even without client pagination input
        expect(output.pagination).toEqual({ limit: 50, offset: 0 });

        const sql = queryBuilder.getSql();
        expect(sql).not.toContain('"user"."email"');
        expect(sql).not.toContain('WHERE');
        expect(sql).not.toContain('ORDER BY');

        const entities = await queryBuilder.getMany();
        expect(entities.length).toEqual(2);
        for (const entity of entities) {
            expect(entity.first_name).toBeDefined();
            expect(entity.email).toBeUndefined();
        }
    });

    it('should enforce server-injected scoping regardless of client input', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema<User>({
            name: 'user',
            filters: { allowed: ['first_name', 'realm_id'] },
        }));
        const decoder = new URLDecoder(registry);

        const applyScoped = (input: string) => {
            const query = decoder.decode(input, { schema: 'user' });

            // plan 012 layer 3: post-parse wrap & inject — immutable,
            // a later replace-merge cannot displace the condition.
            const scoped = new Query({
                ...query,
                filters: query!.filters.and(eq('realm_id', masterRealmId)),
            });

            const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');
            const adapter = new TypeormAdapter({ queryBuilder });
            adapter.execute(scoped);

            return queryBuilder;
        };

        // no client filters: the injected condition alone scopes the list
        const bare = applyScoped('');
        expect(bare.getSql()).toMatch(/"user"\."realm_id" = /);

        const scopedEntities = await bare.getMany();
        expect(scopedEntities.length).toEqual(1);
        expect(scopedEntities[0].first_name).toEqual('Aston');

        // client filter matches caleb, but caleb has no realm:
        // the injected scoping stays in effect alongside client input
        const filtered = applyScoped('filter[first_name]=Caleb');
        expect(filtered.getSql()).toMatch(/"user"\."realm_id" = /);
        expect(await filtered.getMany()).toHaveLength(0);
    });

    it('should reject all client parameters on a strict repository without allow-lists', async () => {
        // typeorm-extension parity: parameters without an explicit
        // allow-list are disabled entirely.
        const strictRepository = createUserRepository(defineSchema<User>({
            name: 'user',
            strict: true,
            pagination: { maxLimit: 50 },
        }));

        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

        const output = strictRepository.applyQuery(
            queryBuilder,
            'fields=email&filter[first_name]=Caleb&include=role&sort=-age&page[limit]=100',
        );

        expect(output.pagination).toEqual({ limit: 50, offset: 0 });

        const sql = queryBuilder.getSql();
        expect(sql).not.toContain('JOIN');
        expect(sql).not.toContain('WHERE');
        expect(sql).not.toContain('ORDER BY');

        const entities = await queryBuilder.getMany();
        expect(entities.length).toEqual(2);
    });
});
