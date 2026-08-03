/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import pg from 'pg';
import type { Condition } from '@rapiq/core';
import {
    FilterCompoundOperator,
    Filters,
    Query,
    eq,
    not,
} from '@rapiq/core';
import { compileFilters } from '@rapiq/adapter-memory';
import { DrizzleAdapter } from '../../src';
import { createAdapterOptions } from '../data';
import { records, splitRecord } from '../data/records';
import {
    casePairs,
    caseRecords,
    collections,
    complementPairs,
    compounds,
    sameElement,
} from '../data/matrix';
import type { User } from '../data/type';

const realms = pgTable('realms', {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
});

const users = pgTable('users', {
    id: integer('id').primaryKey(),
    first_name: text('first_name').notNull(),
    last_name: text('last_name').notNull(),
    email: text('email').notNull(),
    age: integer('age').notNull(),
    address: text('address'),
    realm_id: integer('realm_id'),
});

const items = pgTable('items', {
    id: integer('id').primaryKey(),
    title: text('title').notNull(),
    color: text('color'),
    user_id: integer('user_id'),
});

const relations = defineRelations({
    users, 
    items, 
    realms, 
}, (r) => ({
    users: {
        realm: r.one.realms({ from: r.users.realm_id, to: r.realms.id }),
        items: r.many.items({ from: r.users.id, to: r.items.user_id }),
    },
}));

const enabled = (process.env.DB_TYPE || '').toLowerCase().startsWith('postgres');

const suite = enabled ? describe : describe.skip;

/**
 * The same parity matrix as `complement.spec.ts`, replayed against a
 * live PostgreSQL server, plus the case contract: postgres is the
 * only dialect where `ilike` exists, so the case-insensitive equality
 * default and the escaped-operand exactness can only be measured
 * here. The CI `tests-db` job provides the server.
 */
suite('engine: postgres parity and case contract', () => {
    const rows : User[] = [...records, splitRecord, ...caseRecords];
    const allIds = rows.map((record) => record.id).sort((a, b) => a - b);

    const adapter = new DrizzleAdapter(createAdapterOptions({ provider: 'pg' }));

    let pool : pg.Pool;
    let db : ReturnType<typeof drizzle<typeof relations>>;

    beforeAll(async () => {
        pool = new pg.Pool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT || '5432'),
            user: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'start123',
            database: process.env.DB_DATABASE || 'test',
        });

        db = drizzle({ client: pool, relations });

        await pool.query('drop table if exists items, users, realms');
        await pool.query('create table realms (id integer primary key, name text not null, description text)');
        await pool.query(`create table users (
            id integer primary key,
            first_name text not null,
            last_name text not null,
            email text not null,
            age integer not null,
            address text,
            realm_id integer
        )`);
        await pool.query('create table items (id integer primary key, title text not null, color text, user_id integer)');

        const seen = new Set<number>();
        for (const record of rows) {
            if (record.realm && !seen.has(record.realm.id)) {
                seen.add(record.realm.id);
                await pool.query(
                    'insert into realms values ($1, $2, $3)',
                    [record.realm.id, record.realm.name, record.realm.description],
                );
            }

            await pool.query(
                'insert into users values ($1, $2, $3, $4, $5, $6, $7)',
                [
                    record.id,
                    record.first_name,
                    record.last_name,
                    record.email,
                    record.age,
                    record.address,
                    record.realm_id,
                ],
            );

            for (const item of record.items) {
                await pool.query(
                    'insert into items values ($1, $2, $3, $4)',
                    [item.id, item.title, item.color, record.id],
                );
            }
        }
    });

    afterAll(async () => {
        if (pool) {
            await pool.query('drop table if exists items, users, realms');
            await pool.end();
        }
    });

    const drizzleIds = async (condition: Condition) : Promise<number[]> => {
        const filters = new Filters(FilterCompoundOperator.AND, [condition]);
        const { config } = adapter.execute(new Query({ filters }));

        const found = await db.query.users.findMany(config);

        return found
            .map((record) => record.id)
            .sort((a, b) => a - b);
    };

    const memoryIds = (condition: Condition) : number[] => {
        const predicate = compileFilters(condition);

        return rows
            .filter((record) => predicate(record))
            .map((record) => record.id)
            .sort((a, b) => a - b);
    };

    [...complementPairs, ...casePairs].forEach(([name, positive, negative]) => {
        it(`should agree for ${name}`, async () => {
            const positiveIds = await drizzleIds(positive);
            const negativeIds = await drizzleIds(negative);

            expect(positiveIds).toEqual(memoryIds(positive));
            expect(negativeIds).toEqual(memoryIds(negative));

            expect([...positiveIds, ...negativeIds].sort((a, b) => a - b)).toEqual(allIds);

            expect(await drizzleIds(not(positive))).toEqual(negativeIds);
        });
    });

    [...compounds, ...collections, ...sameElement].forEach(([name, condition]) => {
        it(`should agree for ${name}`, async () => {
            expect(await drizzleIds(condition)).toEqual(memoryIds(condition));
        });
    });

    it('should keep an opted-out equality exact', async () => {
        const exact = new DrizzleAdapter(createAdapterOptions({
            provider: 'pg',
            caseSensitive: true,
        }));

        // matches only the exact-case record, unlike the folded
        // default measured above.
        const { config } = exact.execute(new Query({ filters: new Filters(FilterCompoundOperator.AND, [eq('first_name', 'caleb')]) }));

        const found = await db.query.users.findMany(config);

        expect(found.map((record) => record.id)).toEqual([7]);
    });
});
