/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import Database from 'better-sqlite3';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Condition } from '@rapiq/core';
import {
    FilterCompoundOperator,
    Filters,
    Query,
    and,
    elemMatch,
    eq,
    exists,
    ne,
    not,
} from '@rapiq/core';
import { compileFilters } from '@rapiq/adapter-memory';
import type { Datamodel } from '../../src';
import { DrizzleAdapter, defineMetadata } from '../../src';

const realms = sqliteTable('realms', {
    id: integer('id').primaryKey(),
    name: text('name'),
});

const owners = sqliteTable('owners', {
    id: integer('id').primaryKey(),
    name: text('name'),
    realm_id: integer('realm_id'),
});

const items = sqliteTable('items', {
    id: integer('id').primaryKey(),
    title: text('title'),
    owner_id: integer('owner_id'),
    parent_id: integer('parent_id'),
});

const parents = sqliteTable('parents', {
    id: integer('id').primaryKey(),
    label: text('label'),
});

const relations = defineRelations({
    parents,
    items,
    owners,
    realms,
}, (r) => ({
    parents: { items: r.many.items({ from: r.parents.id, to: r.items.parent_id }) },
    items: { user: r.one.owners({ from: r.items.owner_id, to: r.owners.id }) },
    owners: { realm: r.one.realms({ from: r.owners.realm_id, to: r.realms.id }) },
}));

function createDeepEngine() {
    const client = new Database(':memory:');
    client.exec(`
        create table realms (id integer primary key, name text);
        create table owners (id integer primary key, name text, realm_id integer);
        create table items (id integer primary key, title text, owner_id integer, parent_id integer);
        create table parents (id integer primary key, label text);
        insert into realms values (1, 'master'), (2, 'shire');
        insert into owners values (10, 'o-master', 1), (11, 'o-none', null), (12, 'o-shire', 2);
        insert into items values
            (100, 'a', 10, 1000),
            (101, 'b', 11, 1002),
            (102, 'c', null, 1003),
            (103, 'd', 12, 1000);
        insert into parents values (1000, 'p-two'), (1001, 'p-empty'), (1002, 'p-b'), (1003, 'p-c');
    `);

    return drizzle({ client, relations });
}

// nested plain records, mirroring the seeded rows
const itemRecords = [
    {
        id: 100,
        title: 'a',
        user: {
            id: 10,
            name: 'o-master',
            realm: { id: 1, name: 'master' },
        },
    },
    {
        id: 101,
        title: 'b',
        user: {
            id: 11,
            name: 'o-none',
            realm: null,
        },
    },
    {
        id: 102, 
        title: 'c', 
        user: null, 
    },
    {
        id: 103,
        title: 'd',
        user: {
            id: 12,
            name: 'o-shire',
            realm: { id: 2, name: 'shire' },
        },
    },
];

const parentRecords = [
    {
        id: 1000, 
        label: 'p-two', 
        items: [itemRecords[0], itemRecords[3]], 
    },
    {
        id: 1001, 
        label: 'p-empty', 
        items: [], 
    },
    {
        id: 1002, 
        label: 'p-b', 
        items: [itemRecords[1]], 
    },
    {
        id: 1003, 
        label: 'p-c', 
        items: [itemRecords[2]], 
    },
];

const datamodel : Datamodel = {
    parents: {
        columns: { id: { dataType: 'number', nullable: false }, label: 'string' },
        relations: { items: { target: 'items', many: true } },
    },
    items: {
        columns: {
            id: { dataType: 'number', nullable: false },
            title: { dataType: 'string', nullable: false },
        },
        relations: { user: { target: 'owners', many: false } },
    },
    owners: {
        columns: { id: { dataType: 'number', nullable: false }, name: 'string' },
        relations: { realm: { target: 'realms', many: false } },
    },
    realms: { columns: { id: { dataType: 'number', nullable: false }, name: 'string' } },
};

/**
 * Multi-hop relation chains, the shapes the main fixture cannot
 * reach: a two-level to-one chain from the root (absence arms at
 * every hop) and the same chain INSIDE a factored to-many scope. The
 * engine and `@rapiq/adapter-memory` must select the same records.
 */
describe('cross-adapter parity for deep relation chains', () => {
    const itemAdapter = new DrizzleAdapter({
        provider: 'sqlite',
        metadata: defineMetadata(datamodel, 'items'),
    });
    const parentAdapter = new DrizzleAdapter({
        provider: 'sqlite',
        metadata: defineMetadata(datamodel, 'parents'),
    });

    const agree = async (
        adapter: DrizzleAdapter,
        table: 'items' | 'parents',
        records: Record<string, any>[],
        condition: Condition,
    ) => {
        const filters = new Filters(FilterCompoundOperator.AND, [condition]);
        const { config } = adapter.execute(new Query({ filters }));

        const found = await createDeepEngine().query[table].findMany(config);
        const engine = found.map((row) => row.id).sort((a, b) => a - b);
        const memory = records
            .filter(compileFilters(condition))
            .map((row) => row.id)
            .sort((a, b) => a - b);

        expect(engine).toEqual(memory);
    };

    const fromItems : [string, Condition][] = [
        ['eq through two to-one hops', eq('user.realm.name', 'master')],
        ['ne through two to-one hops', ne('user.realm.name', 'master')],
        ['not(eq) through two to-one hops', not(eq('user.realm.name', 'master'))],
        ['presence of a nested to-one', exists('user.realm')],
        ['absence of a nested to-one', exists('user.realm', false)],
        ['exists on a nested column', exists('user.realm.name')],
        ['not exists on a nested column', exists('user.realm.name', false)],
    ];

    fromItems.forEach(([name, condition]) => {
        it(`should agree from the items root for ${name}`, async () => {
            await agree(itemAdapter, 'items', itemRecords, condition);
        });
    });

    const fromParents : [string, Condition][] = [
        ['eq through a to-many then two to-one hops', eq('items.user.realm.name', 'master')],
        ['ne through a to-many then two to-one hops', ne('items.user.realm.name', 'master')],
        ['not(eq) through the full chain', not(eq('items.user.realm.name', 'master'))],
        ['same-scope conjunct at different depths', and(eq('items.title', 'a'), eq('items.user.realm.name', 'master'))],
        ['same-scope negated deep leaf', and(eq('items.title', 'a'), ne('items.user.realm.name', 'shire'))],
        ['negated group over the chain', not(and(eq('items.title', 'a'), eq('items.user.realm.name', 'master')))],
        ['elemMatch with a deep interior', elemMatch('items', eq('user.realm.name', 'master'))],
        ['not(elemMatch) with a deep interior', not(elemMatch('items', eq('user.realm.name', 'master')))],
        ['presence through the to-many', exists('items.user')],
        ['absence through the to-many', exists('items.user', false)],
    ];

    fromParents.forEach(([name, condition]) => {
        it(`should agree from the parents root for ${name}`, async () => {
            await agree(parentAdapter, 'parents', parentRecords, condition);
        });
    });
});
