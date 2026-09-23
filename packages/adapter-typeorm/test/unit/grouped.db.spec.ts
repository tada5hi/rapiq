/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral, Query } from '@rapiq/core';
import {
    Filter,
    FilterFieldOperator,
    Sort,
    SortDirection,
    Sorts,
    defineQuery,
} from '@rapiq/core';
import { applyGroupedQuery } from '@rapiq/adapter-memory';
import type { DataSource, DataSourceOptions, SelectQueryBuilder } from 'typeorm';
import type { RelationsAdapterOptions } from '../../src';
import { TypeormAdapter } from '../../src';
import { Activity, ActivityTag } from '../data/entity/activity';
import { Reading } from '../data/entity/reading';
import { createDataSource, createDataSourceOptions } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';

type Seed = {
    scope: string | null,
    name: string,
    amount: number,
    /** UTC wall clock, the form a zone-less column stores. */
    stored: string,
    inMaster: boolean,
};

/**
 * 22:59:59 UTC is the next calendar day on a UTC+2 host: a bucket
 * computed in the host's or the session's zone lands one day late.
 * 2026-08-31 22:30 UTC is September there: the same slip one month late.
 */
const SEED : Seed[] = [
    {
        scope: 'auth',
        name: 'login',
        amount: 5,
        stored: '2026-08-20 09:15:00.000',
        inMaster: true,
    },
    {
        scope: 'auth',
        name: 'login',
        amount: 7,
        stored: '2026-08-20 22:59:59.000',
        inMaster: true,
    },
    {
        scope: 'auth',
        name: 'logout',
        amount: 1,
        stored: '2026-08-21 00:00:00.000',
        inMaster: true,
    },
    {
        scope: 'billing',
        name: 'charge',
        amount: 100,
        stored: '2026-09-01 10:30:00.000',
        inMaster: true,
    },
    {
        scope: null,
        name: 'ping',
        amount: 0,
        stored: '2026-09-01 11:00:00.000',
        inMaster: false,
    },
    {
        scope: 'billing',
        name: 'refund',
        amount: 3,
        stored: '2026-08-31 22:30:00.000',
        inMaster: false,
    },
];

const toInstant = (stored: string) => `${stored.replace(' ', 'T')}Z`;

describe('src/adapter/module.ts (grouped, engine parity)', () => {
    let dataSource : DataSource;
    let masterId : number;
    let records : ObjectLiteral[];

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const [master] = await createRealmSeed(dataSource);
        masterId = master!.id;

        const repository = dataSource.getRepository(Activity);
        const saved = await repository.save(SEED.map((row) => repository.create({
            scope: row.scope,
            name: row.name,
            amount: row.amount,
            realm_id: row.inMaster ? masterId : null,
        })));

        // storage literals, not typeorm's host-zone write path: the
        // spec measures rapiq's contract (a zone-less column is UTC).
        for (const [index, activity] of saved.entries()) {
            await dataSource.createQueryBuilder()
                .update(Activity)
                .set({ created_at: () => ':storedAt' })
                .where('id = :id', { id: activity.id })
                .setParameter('storedAt', SEED[index]!.stored)
                .execute();
        }

        await dataSource.getRepository(ActivityTag).save([
            { name: 'a', activity_id: saved[0]!.id },
            { name: 'b', activity_id: saved[0]!.id },
        ]);

        records = saved.map((activity, index) => ({
            id: activity.id,
            scope: SEED[index]!.scope,
            name: SEED[index]!.name,
            amount: SEED[index]!.amount,
            realm_id: SEED[index]!.inMaster ? masterId : null,
            realm: SEED[index]!.inMaster ? { id: masterId, name: master!.name } : null,
            created_at: toInstant(SEED[index]!.stored),
        }));
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    const run = async (
        query: Query,
        options: {
            prepare?: (queryBuilder: SelectQueryBuilder<Activity>) => void,
            relations?: RelationsAdapterOptions,
        } = {},
    ) : Promise<ObjectLiteral[]> => {
        const queryBuilder = dataSource
            .getRepository(Activity)
            .createQueryBuilder('activity');

        if (options.prepare) {
            options.prepare(queryBuilder);
        }

        const adapter = new TypeormAdapter({ queryBuilder, relations: options.relations });
        const output = adapter.executeGrouped(query);

        return output.normalize(await queryBuilder.getRawMany());
    };

    const oracle = (query: Query) : ObjectLiteral[] => applyGroupedQuery(query, records).data;

    const inMaster = () => new Filter(FilterFieldOperator.EQUAL, 'realm_id', masterId);

    it('should answer the issue query (day bucket, scope, name, count)', async () => {
        const query = defineQuery({
            groups: [{ name: 'bucket', params: ['created_at', 'day'] }, 'scope', 'name'],
            aggregates: ['count'],
            filters: inMaster(),
        });

        const rows = await run(query);

        expect(rows).toEqual([
            {
                bucket_created_at_day: '2026-08-20T00:00:00.000Z',
                scope: 'auth',
                name: 'login',
                count: 2,
            },
            {
                bucket_created_at_day: '2026-08-21T00:00:00.000Z',
                scope: 'auth',
                name: 'logout',
                count: 1,
            },
            {
                bucket_created_at_day: '2026-09-01T00:00:00.000Z',
                scope: 'billing',
                name: 'charge',
                count: 1,
            },
        ]);
        expect(rows).toEqual(oracle(query));
    });

    it('should bucket by hour and sum a column', async () => {
        const query = defineQuery({
            groups: [{ name: 'bucket', params: ['created_at', 'hour'] }],
            aggregates: ['count', { name: 'sum', params: ['amount'] }],
            filters: inMaster(),
        });

        const rows = await run(query);

        expect(rows).toEqual([
            {
                bucket_created_at_hour: '2026-08-20T09:00:00.000Z',
                count: 1,
                sum_amount: 5,
            },
            {
                bucket_created_at_hour: '2026-08-20T22:00:00.000Z',
                count: 1,
                sum_amount: 7,
            },
            {
                bucket_created_at_hour: '2026-08-21T00:00:00.000Z',
                count: 1,
                sum_amount: 1,
            },
            {
                bucket_created_at_hour: '2026-09-01T10:00:00.000Z',
                count: 1,
                sum_amount: 100,
            },
        ]);
        expect(rows).toEqual(oracle(query));
    });

    it.each(['hour', 'day', 'month'])('should keep a %s bucket intact beside caller parameters named like its format', async (unit) => {
        const query = defineQuery({
            groups: [{ name: 'bucket', params: ['created_at', unit] }],
            aggregates: ['count'],
            filters: inMaster(),
        });

        // typeorm rewrites `:<name>` for every parameter key, inside
        // string literals too.
        const rows = await run(query, {
            prepare: (queryBuilder) => {
                queryBuilder.where('1 = 1').setParameters({
                    timestamp: 'x',
                    MI: 'x',
                    SS: 'x',
                    '00': 'x',
                    '00.000Z': 'x',
                });
            },
        });

        expect(rows).toEqual(oracle(query));
    });

    it('should bucket by month and order by an aggregate', async () => {
        const query = defineQuery({
            groups: [{ name: 'bucket', params: ['created_at', 'month'] }],
            aggregates: ['count'],
            sorts: new Sorts([new Sort('count', SortDirection.DESC)]),
        });

        const rows = await run(query);

        expect(rows).toEqual([
            { bucket_created_at_month: '2026-08-01T00:00:00.000Z', count: 4 },
            { bucket_created_at_month: '2026-09-01T00:00:00.000Z', count: 2 },
        ]);
        expect(rows).toEqual(oracle(query));
    });

    it('should answer aggregates without groups with one row', async () => {
        const query = defineQuery({
            aggregates: [
                'count',
                { name: 'sum', params: ['amount'] },
                { name: 'count', params: ['scope'] },
            ],
        });

        const rows = await run(query);

        expect(rows).toEqual([{
            count: 6,
            sum_amount: 116,
            count_scope: 5,
        }]);
        expect(rows).toEqual(oracle(query));
    });

    it('should answer aggregates over no rows with zero and null', async () => {
        const query = defineQuery({
            aggregates: ['count', { name: 'sum', params: ['amount'] }],
            filters: new Filter(FilterFieldOperator.EQUAL, 'name', 'nope'),
        });

        const rows = await run(query);

        expect(rows).toEqual([{ count: 0, sum_amount: null }]);
        expect(rows).toEqual(oracle(query));
    });

    it('should answer groups over no rows with no rows', async () => {
        const query = defineQuery({
            groups: ['scope'],
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'name', 'nope'),
        });

        const rows = await run(query);

        expect(rows).toEqual([]);
        expect(rows).toEqual(oracle(query));
    });

    it('should keep null as a group of its own', async () => {
        const query = defineQuery({
            groups: ['scope'],
            aggregates: ['count'],
        });

        const rows = await run(query);
        const expected = [
            { scope: 'auth', count: 3 },
            { scope: 'billing', count: 2 },
            { scope: null, count: 1 },
        ];

        // the NULL group's position differs by engine (pg sorts it
        // last ascending, as memory does; mysql and sqlite first), so
        // only membership is compared.
        expect(rows).toHaveLength(3);
        expect(rows).toEqual(expect.arrayContaining(expected));
        expect(oracle(query)).toEqual(expect.arrayContaining(expected));
    });

    it('should page groups across a to-one join', async () => {
        const query = defineQuery({
            groups: ['scope', 'name'],
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'realm.name', 'master'),
            pagination: { limit: 2, offset: 1 },
        });

        const rows = await run(query);

        expect(rows).toEqual([
            {
                scope: 'auth',
                name: 'logout',
                count: 1,
            },
            {
                scope: 'billing',
                name: 'charge',
                count: 1,
            },
        ]);
        expect(rows).toEqual(oracle(query));
    });

    it('should ignore a caller take/skip or limit/offset and page groups by the query alone', async () => {
        const query = defineQuery({
            groups: ['scope'],
            aggregates: ['count'],
            filters: inMaster(),
        });

        const rows = await run(query, {
            prepare: (queryBuilder) => {
                queryBuilder.take(1).skip(1).limit(1).offset(1);
            },
        });

        expect(rows).toEqual([
            { scope: 'auth', count: 3 },
            { scope: 'billing', count: 1 },
        ]);
        expect(rows).toEqual(oracle(query));

        const paged = defineQuery({
            groups: ['scope'],
            aggregates: ['count'],
            filters: inMaster(),
            pagination: { limit: 1, offset: 1 },
        });

        expect(await run(paged, {
            prepare: (queryBuilder) => {
                queryBuilder.take(5).skip(0);
            },
        })).toEqual([{ scope: 'billing', count: 1 }]);
    });

    it('should keep a join hook from regrouping the rows', async () => {
        const query = defineQuery({
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'realm.name', 'master'),
        });

        const rows = await run(query, {
            relations: {
                onJoin: (_path, _alias, queryBuilder) => {
                    queryBuilder.addGroupBy(`${queryBuilder.alias}.id`);
                },
            },
        });

        expect(rows).toEqual([{ count: 4 }]);
        expect(rows).toEqual(oracle(query));
    });

    it('should group across a to-many join without duplicating groups', async () => {
        const query = defineQuery({
            groups: ['scope'],
            filters: inMaster(),
        });

        const rows = await run(query, {
            prepare: (queryBuilder) => {
                queryBuilder.leftJoin('activity.tags', 'tag');
            },
        });

        expect(rows).toEqual([{ scope: 'auth' }, { scope: 'billing' }]);
        expect(rows).toEqual(oracle(query));
    });
});

describe.runIf(process.env.DB_TYPE === 'postgres')('src/adapter/module.ts (grouped, zone-aware column)', () => {
    const OBSERVED = ['2026-08-20T23:30:00.000Z', '2026-08-21T00:30:00.000Z'];
    /** zone-less `timestamp` storage literals (UTC wall clock). */
    const RECORDED = ['2026-08-31 22:30:00', '2026-09-01 00:30:00'];
    /** `date` storage literals. */
    const OBSERVED_ON = ['2026-08-31', '2026-09-01'];

    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = createDataSource({
            ...createDataSourceOptions(),
            entities: [Reading],
        } as DataSourceOptions);
        await dataSource.initialize();
        await dataSource.synchronize();

        await dataSource.query(
            'insert into "reading" ("observed_at", "recorded_at", "observed_on", "value") ' +
            'values ($1, $3, $5, 1), ($2, $4, $6, 2)',
            [...OBSERVED, ...RECORDED, ...OBSERVED_ON],
        );
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('should bucket in UTC whatever the session zone is', async () => {
        const query = defineQuery({
            groups: [{ name: 'bucket', params: ['observed_at', 'day'] }],
            aggregates: ['count'],
        });

        // Berlin puts both instants on 2026-08-21: truncating without
        // converting to UTC first would answer one group of two.
        const runner = dataSource.createQueryRunner();
        await runner.connect();

        try {
            await runner.query('set time zone \'Europe/Berlin\'');

            const queryBuilder = dataSource
                .getRepository(Reading)
                .createQueryBuilder('reading', runner);

            const output = new TypeormAdapter({ queryBuilder }).executeGrouped(query);
            const rows = output.normalize(await queryBuilder.getRawMany());

            expect(rows).toEqual([
                { bucket_observed_at_day: '2026-08-20T00:00:00.000Z', count: 1 },
                { bucket_observed_at_day: '2026-08-21T00:00:00.000Z', count: 1 },
            ]);
            expect(rows).toEqual(applyGroupedQuery(query, OBSERVED.map((observed_at, index) => ({
                observed_at,
                value: index + 1,
            }))).data);
        } finally {
            await runner.release();
        }
    });

    const records = () => OBSERVED.map((observed_at, index) => ({
        observed_at,
        recorded_at: `${RECORDED[index]!.replace(' ', 'T')}Z`,
        observed_on: OBSERVED_ON[index],
        value: index + 1,
    }));

    it.each([
        ['recorded_at', 'month', ['2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z']],
        ['recorded_at', 'day', ['2026-08-31T00:00:00.000Z', '2026-09-01T00:00:00.000Z']],
        ['observed_on', 'month', ['2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z']],
        ['observed_on', 'hour', ['2026-08-31T00:00:00.000Z', '2026-09-01T00:00:00.000Z']],
    ])('should bucket %s by %s like memory under a Berlin session', async (column, unit, buckets) => {
        const query = defineQuery({
            groups: [{ name: 'bucket', params: [column, unit] }],
            aggregates: ['count'],
        });

        const runner = dataSource.createQueryRunner();
        await runner.connect();

        try {
            await runner.query('set time zone \'Europe/Berlin\'');

            // parameters named like the cast and format fragments
            // must not be substituted into the bucket expression.
            const queryBuilder = dataSource
                .getRepository(Reading)
                .createQueryBuilder('reading', runner)
                .where('1 = 1')
                .setParameters({
                    timestamp: 'x',
                    MI: 'x',
                    SS: 'x',
                });

            const output = new TypeormAdapter({ queryBuilder }).executeGrouped(query);
            const rows = output.normalize(await queryBuilder.getRawMany());

            expect(rows).toEqual(buckets.map((bucket) => ({ bucket, count: 1 })));
            expect(rows).toEqual(applyGroupedQuery(query, records()).data);
        } finally {
            await runner.release();
        }
    });
});
