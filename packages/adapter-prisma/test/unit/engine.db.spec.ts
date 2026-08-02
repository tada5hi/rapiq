/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition, Filter, Filters } from '@rapiq/core';
import {
    AdapterError,
    FilterCompoundOperator,
    Filters as FiltersNode,
    Pagination,
    Query,
    Sort,
    SortDirection,
    Sorts,
    and,
    eq,
    gte,
    ne,
    not,
} from '@rapiq/core';
import { compileFilters } from '@rapiq/adapter-memory';
import { PrismaAdapter, defineMetadata } from '../../src';
import type { TestDatabase } from '../data/client';
import { createDatabase } from '../data/client';
import { datamodel } from '../data/datamodel';
import { selectRows } from '../data/evaluate';
import { parityConditions } from '../data/matrix';
import type { User } from '../data/type';

/**
 * The parity gate, executed by a real prisma query engine.
 *
 * Every condition is run three ways: through the engine against a
 * live SQLite database, through `@rapiq/adapter-memory`, and through the
 * in-test evaluator, and all three must select the same records. The
 * engine is the ground truth: it decides whether the emitted argument
 * object is even *valid*, whether the semantics hold, and whether the
 * evaluator used by the engine-free suite is a faithful model.
 */
describe('engine parity (prisma vs memory)', () => {
    const records : User[] = [
        {
            id: 1,
            first_name: 'Caleb',
            last_name: 'Barrows',
            email: 'caleb.barrows@gmail.com',
            age: 18,
            address: 'Hogwarts',
            realm_id: 1,
            realm: {
                id: 1, 
                name: 'master', 
                description: null, 
            },
            items: [{
                id: 1, 
                title: 'book', 
                color: 'red', 
            }],
        },
        {
            id: 2,
            first_name: 'Aston',
            last_name: 'Nel',
            email: 'ashton.nel@gmail.com',
            age: 60,
            address: null,
            realm_id: null,
            realm: null,
            items: [],
        },
        {
            id: 3,
            first_name: 'Frodo',
            last_name: 'Baggins',
            email: 'frodo.baggins@gmail.com',
            age: 33,
            address: 'Mordor',
            realm_id: 2,
            realm: {
                id: 2, 
                name: 'shire', 
                description: 'the shire', 
            },
            items: [
                {
                    id: 2, 
                    title: 'ring', 
                    color: null, 
                },
                {
                    id: 3, 
                    title: 'book', 
                    color: 'blue', 
                },
            ],
        },

        {
            id: 4,
            first_name: 'Split',
            last_name: 'Case',
            email: 'split@case.io',
            age: 21,
            address: null,
            realm_id: null,
            realm: null,
            items: [
                {
                    id: 4,
                    title: 'book',
                    color: 'silver',
                },
                {
                    id: 5,
                    title: 'ring',
                    color: 'red',
                },
            ],
        },
    ];

    let database : TestDatabase;
    let adapter : PrismaAdapter;

    beforeAll(async () => {
        database = await createDatabase(records);

        // prisma 7 prunes the runtime datamodel to names and kinds,
        // so the metadata comes from the hand-written fixture; the
        // drift spec below holds the fixture against the real
        // datamodel of the engine under test.
        adapter = new PrismaAdapter({
            provider: database.provider,
            metadata: defineMetadata(datamodel, 'User'),
        });
    }, 120_000);

    afterAll(async () => {
        await database.destroy();
    });

    const build = (condition: Condition) => adapter.execute(new Query({ filters: new FiltersNode(FilterCompoundOperator.AND, [condition]) })).args;

    const engineIds = async (condition: Condition) : Promise<number[]> => {
        const rows = await database.client.user.findMany({
            where: build(condition).where,
            select: { id: true },
        });

        return rows.map((row) => row.id).sort((a, b) => a - b);
    };

    const memoryIds = (condition: Condition) : number[] => records
        .filter((record) => compileFilters(condition as Filter | Filters)(record))
        .map((record) => record.id)
        .sort((a, b) => a - b);

    const evaluatorIds = (condition: Condition) : number[] => selectRows(build(condition).where, records)
        .map((record) => record.id)
        .sort((a, b) => a - b);

    parityConditions.forEach(([name, condition]) => {
        it(`should agree with the engine for ${name}`, async () => {
            const ids = await engineIds(condition);

            // the contract, the records a query selects in memory are
            // the records it selects in the database.
            expect(ids).toEqual(memoryIds(condition));

            // and the engine-free suite's model of prisma is faithful.
            expect(ids).toEqual(evaluatorIds(condition));
        });
    });

    it('should apply the whole argument object', async () => {
        const { args, pagination } = adapter.execute(new Query({
            ...new Query(),
            filters: new FiltersNode(FilterCompoundOperator.AND, [gte('age', 18)]),
        }));

        expect(pagination).toEqual({ limit: undefined, offset: undefined });

        const rows = await database.client.user.findMany(args);
        expect(rows).toHaveLength(4);
    });

    it('should bind from a real model delegate', async () => {
        // the bound form reads model name and provider off the
        // delegate's runtime backref; this pins those private
        // internals against the real generated client. The metadata
        // stays explicit: prisma 7 prunes the runtime datamodel the
        // one-argument form would derive it from.
        const bound = new PrismaAdapter({
            model: database.client.user,
            metadata: defineMetadata(datamodel, 'User'),
        });

        expect(() => new PrismaAdapter({ model: database.client.user })).toThrow(AdapterError);

        const conditions : Condition[] = [
            eq('address', 'Hogwarts'),
            ne('items.title', 'book'),
            not(and(eq('realm.name', 'master'), gte('age', 18))),
        ];

        for (const condition of conditions) {
            const expected = adapter.execute(new Query({ filters: new FiltersNode(FilterCompoundOperator.AND, [condition]) })).args;

            const derived = bound.execute(new Query({ filters: new FiltersNode(FilterCompoundOperator.AND, [condition]) })).args;

            expect(derived).toEqual(expected);

            const rows = await database.client.user.findMany({
                where: derived.where,
                select: { id: true },
            });

            expect(rows.map((row: any) => row.id).sort((a: number, b: number) => a - b))
                .toEqual(memoryIds(condition));
        }
    });

    it('should run the whole request through the bound model', async () => {
        const bound = new PrismaAdapter({
            model: database.client.user,
            metadata: defineMetadata(datamodel, 'User'),
        });

        const request = new Query({
            filters: new FiltersNode(FilterCompoundOperator.AND, [gte('age', 21)]),
            sorts: new Sorts([new Sort('id', SortDirection.ASC)]),
            pagination: new Pagination(2, 0),
        });

        // the rows-plus-total composition a list endpoint runs
        const [data, total] = await Promise.all([
            bound.findMany(request),
            bound.count(request),
        ]);

        // ages: 18, 60, 33, 21 -> matched ids [2, 3, 4], page of 2
        expect(data.map((row: any) => row.id)).toEqual([2, 3]);
        expect(total).toEqual(3);
    });

    it('should conjoin a baseline where when running', async () => {
        const bound = new PrismaAdapter({
            model: database.client.user,
            metadata: defineMetadata(datamodel, 'User'),
        });

        const rows = await bound.findMany(new Query({
            filters: new FiltersNode(FilterCompoundOperator.AND, [gte('age', 21)]),
            sorts: new Sorts([new Sort('id', SortDirection.ASC)]),
        }), { base: { where: { address: { not: null } } } });

        // of ids [2, 3, 4], only 3 has an address
        expect(rows.map((row: any) => row.id)).toEqual([3]);
    });

    it('should reject the pruned runtime datamodel of the engine', () => {
        // prisma 7 strips cardinality and nullability from every
        // runtime datamodel (the wasm build is the only build);
        // deriving metadata from it would guess, so it throws.
        expect(() => defineMetadata(database.datamodel, 'User')).toThrow(AdapterError);
    });

    it('should keep the engine-free fixture datamodel faithful', () => {
        // the specs run against a hand-written datamodel; the pruned
        // real one still names every model, field, kind and type, so
        // structural drift from the live schema fails here (the
        // cardinality and nullability the fixture adds are covered
        // behaviorally by the parity assertions above).
        for (const model of datamodel.models) {
            const real = database.datamodel.models.find((entry: any) => entry.name === model.name);

            expect(real).toBeDefined();

            for (const field of model.fields) {
                const match = real.fields.find((entry: any) => entry.name === field.name);

                expect([model.name, field.name, match?.kind, match?.type])
                    .toEqual([model.name, field.name, field.kind, field.type]);
            }
        }
    });

    it('should apply the case contract of the connector', async () => {
        // measured, not assumed. Postgres accepts `mode: 'insensitive'`
        // so the rapiq default holds; sqlite has no `mode` and compares
        // `=` case-sensitively, which is the documented limitation.
        const ids = await engineIds(eq('first_name', 'caleb'));

        if (database.provider === 'sqlite') {
            expect(ids).toEqual([]);
        } else {
            expect(ids).toEqual(memoryIds(eq('first_name', 'caleb')));
            expect(ids).toEqual([1]);
        }
    });

    it('should not let a like wildcard widen an equality', async () => {
        // The reason `buildMode` vetoes `%`/`_`, an insensitive
        // `equals` lowers to ILIKE with the operand passed through
        // verbatim (prisma#20318), so `_` would match any character.
        // This measures whether the veto is actually load-bearing.
        await database.client.user.createMany({
            data: [
                {
                    id: 90, 
                    first_name: 'A_B', 
                    last_name: 'x', 
                    email: 'x', 
                    age: 1, 
                    address: 'a_b',
                },
                {
                    id: 91, 
                    first_name: 'AxB', 
                    last_name: 'x', 
                    email: 'x', 
                    age: 1, 
                    address: 'axb',
                },
            ],
        });

        try {
            const { args } = adapter.execute(new Query({ filters: new FiltersNode(FilterCompoundOperator.AND, [eq('address', 'a_b')]) }));

            const rows = await database.client.user.findMany({
                where: args.where,
                select: { id: true },
            });

            // exactly the literal match: never the wildcard neighbour
            expect(rows.map((row: any) => row.id)).toEqual([90]);

            if (database.provider !== 'postgresql') {
                return;
            }

            // and the veto is genuinely load-bearing, the same filter
            // WITH `mode` matches the neighbour too, because prisma
            // lowers an insensitive `equals` to ILIKE.
            const widened = await database.client.user.findMany({
                where: { address: { equals: 'a_b', mode: 'insensitive' } },
                select: { id: true },
            });

            expect(widened.map((row: any) => row.id)).toEqual([90, 91]);

            // `in` is NOT lowered, so it keeps case-insensitivity even
            // for a value carrying a wildcard, the veto stays off it.
            const membership = adapter.execute(new Query({ filters: new FiltersNode(FilterCompoundOperator.AND, [inArray('address', ['A_B'])]) })).args;

            expect(membership.where).toEqual({ address: { in: ['A_B'], mode: 'insensitive' } });

            const matched = await database.client.user.findMany({
                where: membership.where,
                select: { id: true },
            });

            expect(matched.map((row: any) => row.id)).toEqual([90]);
        } finally {
            await database.client.user.deleteMany({ where: { id: { in: [90, 91] } } });
        }
    });
});
