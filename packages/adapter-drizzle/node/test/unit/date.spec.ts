/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition } from '@rapiq/core';
import {
    AdapterError,
    ErrorCode,
    FilterCompoundOperator,
    Filters,
    Query,
    eq,
    gte,
    inArray,
    ne,
} from '@rapiq/core';
import Database from 'better-sqlite3';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter, defineMetadata } from '../../src';
import { createAdapterOptions } from '../data';

const INSTANT = '2026-08-23T10:16:44.000Z';

const EARLY = '2026-08-20T09:00:00.000Z';

function build(condition: Condition) {
    const adapter = new DrizzleAdapter(createAdapterOptions());
    const { config } = adapter.execute(new Query({ filters: new Filters(FilterCompoundOperator.AND, [condition]) }));

    return config.where;
}

describe('src/adapter/where.ts (date columns)', () => {
    it('should bind a wire string as a date instance', () => {
        expect(build(gte('created_at', INSTANT)))
            .toEqual({ created_at: { gte: new Date(INSTANT) } });
    });

    it('should bind equality operands', () => {
        expect(build(eq('created_at', INSTANT)))
            .toEqual({ created_at: { eq: new Date(INSTANT) } });
    });

    it('should bind every member of a list', () => {
        expect(build(inArray('created_at', [INSTANT, EARLY])))
            .toEqual({ created_at: { in: [new Date(INSTANT), new Date(EARLY)] } });
    });

    it('should bind the operand of a negated comparison', () => {
        expect(build(ne('created_at', INSTANT)))
            .toEqual({
                OR: [
                    { created_at: { ne: new Date(INSTANT) } },
                    { created_at: { isNull: true } },
                ],
            });
    });

    it('should read an epoch timestamp in milliseconds', () => {
        expect(build(eq('created_at', Date.parse(INSTANT))))
            .toEqual({ created_at: { eq: new Date(INSTANT) } });
    });

    it('should leave a non-date column untouched', () => {
        expect(build(eq('address', INSTANT)))
            .toEqual({ address: { ilike: INSTANT } });
    });

    it('should refuse a value which denotes no instant', () => {
        expect(() => build(eq('created_at', 'yesterday')))
            .toThrowError(expect.objectContaining({ code: ErrorCode.KEY_VALUE_INVALID }));
        expect(() => build(eq('created_at', 'yesterday')))
            .toThrowError(AdapterError);
    });
});

/**
 * A timestamp column is stored as an epoch integer and drizzle maps a
 * `Date` onto it; a wire string reaches `mapToDriverValue` as-is and
 * fails there ("value.getTime is not a function"), so only the real
 * engine shows the operand arrives bindable.
 */
describe('engine: date columns', () => {
    const events = sqliteTable('events', {
        id: integer('id').primaryKey(),
        name: text('name').notNull(),
        created_at: integer('created_at', { mode: 'timestamp' }),
    });

    const relations = defineRelations({ events }, () => ({ events: {} }));

    const adapter = new DrizzleAdapter({
        provider: 'sqlite',
        metadata: defineMetadata({
            events: {
                columns: {
                    id: { dataType: 'number', nullable: false },
                    name: { dataType: 'string', nullable: false },
                    created_at: { dataType: 'date', nullable: true },
                },
            },
        }, 'events'),
    });

    const run = (condition: Condition) => {
        const client = new Database(':memory:');
        client.exec('create table events (id integer primary key, name text not null, created_at integer)');

        const insert = client.prepare('insert into events values (?, ?, ?)');
        insert.run(1, 'early', Date.parse(EARLY) / 1000);
        insert.run(2, 'late', Date.parse(INSTANT) / 1000);

        const { config } = adapter.execute(new Query({ filters: new Filters(FilterCompoundOperator.AND, [condition]) }));

        return drizzle({ client, relations }).query.events.findMany(config);
    };

    it('should select the window a wire date range describes', async () => {
        const rows = await run(gte('created_at', '2026-08-23T00:00:00.000Z'));

        expect(rows.map((row) => row.name)).toEqual(['late']);
    });

    it('should match the exact instant the api returned', async () => {
        const rows = await run(eq('created_at', INSTANT));

        expect(rows.map((row) => row.name)).toEqual(['late']);
    });
});
