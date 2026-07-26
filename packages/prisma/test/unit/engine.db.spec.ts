/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition, Filter, Filters } from '@rapiq/core';
import {
    FilterCompoundOperator,
    Filters as FiltersNode,
    Pagination,
    Query,
    Sort,
    SortDirection,
    Sorts,
    and,
    contains,
    elemMatch,
    endsWith,
    eq,
    exists,
    gte,
    inArray,
    lt,
    ne,
    nin,
    not,
    notContains,
    notEndsWith,
    notStartsWith,
    or,
    startsWith,
} from '@rapiq/core';
import { compileFilters } from '@rapiq/memory';
import { PrismaAdapter, defineMetadata } from '../../src';
import type { TestDatabase } from '../data/client';
import { createDatabase } from '../data/client';
import { datamodel } from '../data/datamodel';
import { selectRows } from '../data/evaluate';
import type { User } from '../data/type';

/**
 * The parity gate, executed by a real prisma query engine.
 *
 * Every condition is run three ways: through the engine against a
 * live SQLite database, through `@rapiq/memory`, and through the
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

        // the metadata the adapter consumes comes from the REAL
        // datamodel of the engine under test, not the fixture.
        adapter = new PrismaAdapter({
            provider: database.provider,
            metadata: defineMetadata(database.datamodel, 'User'),
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

    // Case-matched literals throughout: SQLite compares `equals`
    // case-sensitively and has no `mode`, which the dedicated test
    // below measures instead of assuming.
    const conditions : [string, Condition][] = [
        ['eq', eq('address', 'Hogwarts')],
        ['ne', ne('address', 'Hogwarts')],
        ['eq (null)', eq('address', null)],
        ['ne (null)', ne('address', null)],
        ['exists', exists('address')],
        ['exists false', exists('address', false)],
        ['in', inArray('address', ['Hogwarts', 'Mordor'])],
        ['nin', nin('address', ['Hogwarts', 'Mordor'])],
        ['in (null member)', inArray('address', ['Hogwarts', null])],
        ['nin (null member)', nin('address', ['Hogwarts', null])],
        ['in (empty)', inArray('address', [])],
        ['nin (empty)', nin('address', [])],
        ['gte', gte('age', 33)],
        ['not(gte)', not(gte('age', 33))],
        ['contains', contains('address', 'ord')],
        ['notContains', notContains('address', 'ord')],
        ['startsWith', startsWith('address', 'Hog')],
        ['notStartsWith', notStartsWith('address', 'Hog')],
        ['endsWith', endsWith('address', 'arts')],
        ['notEndsWith', notEndsWith('address', 'arts')],

        ['to-one eq', eq('realm.name', 'master')],
        ['to-one ne', ne('realm.name', 'master')],
        ['to-one null column', eq('realm.description', null)],
        ['to-one null column (negated)', ne('realm.description', null)],
        ['to-one relation exists', exists('realm')],
        ['to-one relation absent', exists('realm', false)],

        ['to-many eq', eq('items.title', 'book')],
        ['to-many ne', ne('items.title', 'book')],
        ['to-many not(eq)', not(eq('items.title', 'book'))],
        ['to-many null column', eq('items.color', null)],
        ['to-many null column (negated)', ne('items.color', null)],
        ['to-many in', inArray('items.color', ['red', null])],
        ['to-many nin', nin('items.color', ['red', null])],
        ['to-many contains', contains('items.title', 'oo')],
        ['to-many notContains', notContains('items.title', 'oo')],
        ['to-many relation exists', exists('items')],
        ['to-many relation absent', exists('items', false)],

        ['same-element and', and(eq('items.title', 'book'), eq('items.color', 'red'))],
        ['same-element or', or(eq('items.title', 'ring'), eq('items.color', 'silver'))],
        ['same-element negated leaf', and(ne('items.title', 'ring'), eq('items.color', 'red'))],
        ['same-element mixed nesting', and(eq('items.title', 'book'), or(eq('items.color', 'red'), gte('age', 21)))],
        ['same-element negated group', not(and(eq('items.title', 'book'), eq('items.color', 'red')))],

        ['elemMatch', elemMatch('items', and(eq('title', 'book'), eq('color', 'red')))],
        ['elemMatch (null interior)', elemMatch('items', eq('color', null))],
        ['not(elemMatch)', not(elemMatch('items', and(eq('title', 'book'), eq('color', 'red'))))],

        ['not(and)', not(and(eq('address', 'Hogwarts'), gte('age', 18)))],
        ['not(or)', not(or(eq('address', 'Hogwarts'), eq('address', 'Mordor')))],
        ['nested', not(or(and(eq('address', 'Mordor'), lt('age', 40)), exists('address', false)))],
        ['relation in a negated group', not(and(eq('realm.name', 'master'), gte('age', 18)))],
    ];

    conditions.forEach(([name, condition]) => {
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
        // the one-argument form reads model name, datamodel and
        // provider off the delegate's runtime backref; this pins those
        // private internals against the real generated client.
        const bound = new PrismaAdapter({ model: database.client.user });

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
        const bound = new PrismaAdapter({ model: database.client.user });

        const output = await bound.apply(new Query({
            filters: new FiltersNode(FilterCompoundOperator.AND, [gte('age', 21)]),
            sorts: new Sorts([new Sort('id', SortDirection.ASC)]),
            pagination: new Pagination(2, 0),
        }));

        // ages: 18, 60, 33, 21 -> matched ids [2, 3, 4], page of 2
        expect(output.data.map((row: any) => row.id)).toEqual([2, 3]);
        expect(output.total).toEqual(3);
        expect(output.pagination).toEqual({ limit: 2, offset: 0 });
    });

    it('should conjoin a baseline where when running', async () => {
        const bound = new PrismaAdapter({ model: database.client.user });

        const rows = await bound.findMany(new Query({
            filters: new FiltersNode(FilterCompoundOperator.AND, [gte('age', 21)]),
            sorts: new Sorts([new Sort('id', SortDirection.ASC)]),
        }), { base: { where: { address: { not: null } } } });

        // of ids [2, 3, 4], only 3 has an address
        expect(rows.map((row: any) => row.id)).toEqual([3]);
    });

    it('should keep the engine-free fixture datamodel faithful', () => {
        // the engine-free specs run against a hand-written datamodel;
        // if it drifts from the real one they prove nothing.
        const real = defineMetadata(database.datamodel, 'User');
        const fixture = defineMetadata(datamodel, 'User');

        const paths = [
            'id', 
            'first_name', 
            'address', 
            'age', 
            'realm_id',
            'realm', 
            'items', 
            'realm.name', 
            'realm.description',
            'items.title', 
            'items.color',
        ];

        for (const path of paths) {
            expect([path, fixture.isRelation(path)]).toEqual([path, real.isRelation(path)]);
            expect([path, fixture.isToMany(path)]).toEqual([path, real.isToMany(path)]);
            expect([path, fixture.isNullable(path)]).toEqual([path, real.isNullable(path)]);
            expect([path, fixture.isString(path)]).toEqual([path, real.isString(path)]);
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
