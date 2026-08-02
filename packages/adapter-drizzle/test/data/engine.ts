/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import Database from 'better-sqlite3';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { User } from './type';

export const realms = sqliteTable('realms', {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
});

export const users = sqliteTable('users', {
    id: integer('id').primaryKey(),
    first_name: text('first_name').notNull(),
    last_name: text('last_name').notNull(),
    email: text('email').notNull(),
    age: integer('age').notNull(),
    address: text('address'),
    realm_id: integer('realm_id'),
});

export const items = sqliteTable('items', {
    id: integer('id').primaryKey(),
    title: text('title').notNull(),
    color: text('color'),
    user_id: integer('user_id'),
});

const schema = {
    users, 
    items, 
    realms, 
};

export const relations = defineRelations(schema, (r) => ({
    users: {
        realm: r.one.realms({ from: r.users.realm_id, to: r.realms.id }),
        items: r.many.items({ from: r.users.id, to: r.items.user_id }),
    },
    items: { user: r.one.users({ from: r.items.user_id, to: r.users.id }) },
}));

export type EngineDatabase = BetterSQLite3Database<typeof relations>;

const DDL = `
    create table realms (id integer primary key, name text not null, description text);
    create table users (
        id integer primary key,
        first_name text not null,
        last_name text not null,
        email text not null,
        age integer not null,
        address text,
        realm_id integer
    );
    create table items (id integer primary key, title text not null, color text, user_id integer);
`;

/**
 * A throwaway in-memory database seeded from the nested fixture
 * records: the engine that decides what an emitted config object
 * actually selects. No server, no file, no codegen.
 */
export function createEngine(records: User[]) : EngineDatabase {
    const client = new Database(':memory:');
    client.exec(DDL);

    const insertRealm = client.prepare('insert or ignore into realms values (?, ?, ?)');
    const insertUser = client.prepare('insert into users values (?, ?, ?, ?, ?, ?, ?)');
    const insertItem = client.prepare('insert into items values (?, ?, ?, ?)');

    for (const record of records) {
        if (record.realm) {
            insertRealm.run(record.realm.id, record.realm.name, record.realm.description);
        }

        insertUser.run(
            record.id,
            record.first_name,
            record.last_name,
            record.email,
            record.age,
            record.address,
            record.realm_id,
        );

        for (const item of record.items) {
            insertItem.run(item.id, item.title, item.color, record.id);
        }
    }

    return drizzle({ client, relations });
}
