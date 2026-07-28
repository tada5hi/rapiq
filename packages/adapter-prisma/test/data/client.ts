/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Provider } from '../../src';
import type { User } from './type';

/**
 * A real, throwaway database driven by a generated prisma client: the
 * ground truth the adapter is measured against.
 *
 * SQLite needs no infrastructure and runs everywhere. Postgres is the
 * connector that actually implements `mode: 'insensitive'`, so the
 * case contract can only be measured there; it runs when `DB_TYPE`
 * names it (the CI `tests-db` job provides the server).
 */
export type TestDatabase = {
    client: any,
    datamodel: { models: any[] },
    provider: `${Provider}`,
    destroy: () => Promise<void>,
};

const DDL = [
    'drop table if exists "Item"',
    'drop table if exists "User"',
    'drop table if exists "Realm"',
    `create table "Realm" (
        "id" integer not null primary key,
        "name" text not null,
        "description" text
    )`,
    `create table "User" (
        "id" integer not null primary key,
        "first_name" text not null,
        "last_name" text not null,
        "email" text not null,
        "age" integer not null,
        "address" text,
        "realm_id" integer references "Realm"("id")
    )`,
    `create table "Item" (
        "id" integer not null primary key,
        "title" text not null,
        "color" text,
        "user_id" integer not null references "User"("id")
    )`,
];

/**
 * Which engine the suite runs against. `postgres` requires a live
 * server; anything else falls back to a SQLite file.
 */
export function resolveProviderName() : `${Provider}` {
    const type = (process.env.DB_TYPE || '').toLowerCase();

    if (type === 'postgres' || type === 'postgresql') {
        return 'postgresql';
    }

    return 'sqlite';
}

function resolveUrl(provider: `${Provider}`, directory: string) : string {
    if (provider === 'sqlite') {
        return `file:${join(directory, 'test.db')}`;
    }

    const host = process.env.DB_HOST || '127.0.0.1';
    const port = process.env.DB_PORT || '5432';
    const user = process.env.DB_USERNAME || 'postgres';
    const password = process.env.DB_PASSWORD || 'start123';
    const database = process.env.DB_DATABASE || 'test';

    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export async function createDatabase(records: User[]) : Promise<TestDatabase> {
    const provider = resolveProviderName();

    const directory = mkdtempSync(join(tmpdir(), 'rapiq-prisma-'));
    const url = resolveUrl(provider, directory);

    const generated = provider === 'sqlite' ?
        await import('../../node_modules/.prisma-test-client/index.js') :
        await import('../../node_modules/.prisma-test-client-postgres/index.js');

    const adapter = provider === 'sqlite' ?
        new PrismaBetterSqlite3({ url }) :
        new PrismaPg(url);

    const client = new generated.PrismaClient({ adapter });

    for (const statement of DDL) {
        await client.$executeRawUnsafe(statement);
    }

    const realms = new Map<number, any>();
    for (const record of records) {
        if (record.realm) {
            realms.set(record.realm.id, record.realm);
        }
    }

    for (const realm of realms.values()) {
        await client.realm.create({ data: realm });
    }

    for (const record of records) {
        await client.user.create({
            data: {
                id: record.id,
                first_name: record.first_name,
                last_name: record.last_name,
                email: record.email,
                age: record.age,
                address: record.address,
                realm_id: record.realm_id,
                items: {
                    create: record.items.map((item) => ({
                        id: item.id,
                        title: item.title,
                        color: item.color,
                    })),
                },
            },
        });
    }

    return {
        client,
        datamodel: generated.Prisma.dmmf.datamodel,
        provider,
        destroy: async () => {
            await client.$disconnect();
            rmSync(directory, { recursive: true, force: true });
        },
    };
}
