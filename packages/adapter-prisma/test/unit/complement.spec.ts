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
    Query,
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
import { compileFilters } from '@rapiq/adapter-memory';
import { PrismaAdapter } from '../../src';
import { createAdapterOptions } from '../data/schema';
import { selectRows } from '../data/evaluate';
import type { User } from '../data/type';

/**
 * The cross-backend semantics gate, the emitted prisma `where` is
 * evaluated with prisma's own three-valued rules and must select
 * exactly the records `@rapiq/adapter-memory` selects, the same obligation
 * `@rapiq/adapter-typeorm` discharges against a live database.
 */
describe('cross-adapter complement law (memory vs prisma)', () => {
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
    ];

    const allIds = records.map((record) => record.id).sort((a, b) => a - b);

    const prismaIds = (condition: Condition) : number[] => {
        const filters = new FiltersNode(FilterCompoundOperator.AND, [condition]);
        const { args } = new PrismaAdapter(createAdapterOptions()).execute(new Query({ filters }));

        return selectRows(args.where, records)
            .map((record) => record.id)
            .sort((a, b) => a - b);
    };

    const memoryIds = (condition: Condition) : number[] => {
        const predicate = compileFilters(condition as Filter | Filters);

        return records
            .filter((record) => predicate(record))
            .map((record) => record.id)
            .sort((a, b) => a - b);
    };

    // address is 'Hogwarts', NULL and 'Mordor'; realm is present,
    // absent and present; items has one, zero and one element.
    const pairs : [string, Condition, Condition][] = [
        ['eq/ne', eq('address', 'Hogwarts'), ne('address', 'Hogwarts')],
        ['eq/ne (null)', eq('address', null), ne('address', null)],
        ['in/nin', inArray('address', ['Hogwarts', 'Mordor']), nin('address', ['Hogwarts', 'Mordor'])],
        ['in/nin (null member)', inArray('address', ['Hogwarts', null]), nin('address', ['Hogwarts', null])],
        ['in/nin (empty)', inArray('address', []), nin('address', [])],
        ['contains/notContains', contains('address', 'wart'), notContains('address', 'wart')],
        ['startsWith/notStartsWith', startsWith('address', 'Hog'), notStartsWith('address', 'Hog')],
        ['endsWith/notEndsWith', endsWith('address', 'arts'), notEndsWith('address', 'arts')],
        ['exists true/false', exists('address'), exists('address', false)],
        ['eq/ne (to-one relation)', eq('realm.name', 'master'), ne('realm.name', 'master')],
        ['eq/ne (case)', eq('first_name', 'caleb'), ne('first_name', 'caleb')],
    ];

    pairs.forEach(([name, positive, negative]) => {
        it(`should agree for ${name}`, () => {
            const positiveIds = prismaIds(positive);
            const negativeIds = prismaIds(negative);

            expect(positiveIds).toEqual(memoryIds(positive));
            expect(negativeIds).toEqual(memoryIds(negative));

            // the negation selects exactly the remaining records.
            expect([...positiveIds, ...negativeIds].sort((a, b) => a - b)).toEqual(allIds);

            // the first-class NOT node is the same complement.
            expect(prismaIds(not(positive))).toEqual(negativeIds);
            expect(memoryIds(not(positive))).toEqual(negativeIds);
        });
    });

    // De Morgan push-down has to hold for whole trees, not just leaves.
    const compounds : [string, Condition][] = [
        ['not(and)', not(and(eq('address', 'Hogwarts'), gte('age', 18)))],
        ['not(or)', not(or(eq('address', 'Hogwarts'), eq('address', 'Mordor')))],
        ['not(not(and))', not(not(and(eq('address', 'Hogwarts'), gte('age', 18))))],
        ['nested', not(or(and(eq('address', 'Mordor'), lt('age', 40)), exists('address', false)))],
        ['relation inside a negated group', not(and(eq('realm.name', 'master'), gte('age', 18)))],
    ];

    compounds.forEach(([name, condition]) => {
        it(`should agree for ${name}`, () => {
            expect(prismaIds(condition)).toEqual(memoryIds(condition));
        });
    });

    /**
     * A to-many path binds per element (per left-joined row), so a
     * record with a matching *and* a non-matching element satisfies
     * both a condition and its negation, the pair does not partition
     * the records, and only agreement with the reference backend is
     * asserted. Record 3 carries two items exactly for this.
     */
    const collections : [string, Condition][] = [
        ['eq', eq('items.title', 'book')],
        ['ne', ne('items.title', 'book')],
        ['not(eq)', not(eq('items.title', 'book'))],
        ['eq (null column)', eq('items.color', null)],
        ['ne (null column)', ne('items.color', null)],
        ['exists', exists('items.color')],
        ['exists false', exists('items.color', false)],
        ['in', inArray('items.color', ['red', null])],
        ['nin', nin('items.color', ['red', null])],
        ['contains', contains('items.title', 'oo')],
        ['notContains', notContains('items.title', 'oo')],
        ['elemMatch', elemMatch('items', and(eq('title', 'book'), eq('color', 'red')))],
        ['not(elemMatch)', not(elemMatch('items', and(eq('title', 'book'), eq('color', 'red'))))],
    ];

    collections.forEach(([name, condition]) => {
        it(`should agree for a to-many path: ${name}`, () => {
            expect(prismaIds(condition)).toEqual(memoryIds(condition));
        });
    });

    /**
     * Same-element binding: sibling conditions on one to-many path
     * bind to the SAME element on every backend. The factoring pass
     * groups them into one `some` scope, so prisma agrees with the
     * per-join-row evaluation of sql/typeorm and the per-binding
     * evaluation of memory. This record satisfies each condition on a
     * DIFFERENT element and must not match.
     */
    const split : User[] = [{
        id: 9,
        first_name: 'Split',
        last_name: 'Case',
        email: 'split@case.io',
        age: 1,
        address: null,
        realm_id: null,
        realm: null,
        items: [
            {
                id: 90,
                title: 'book',
                color: 'blue',
            },
            {
                id: 91,
                title: 'ring',
                color: 'red',
            },
        ],
    }];

    const sameElement : [string, Condition][] = [
        ['and on one path', and(eq('items.title', 'book'), eq('items.color', 'red'))],
        ['or on one path', or(eq('items.title', 'ring'), eq('items.color', 'blue'))],
        ['negated leaf in the group', and(ne('items.title', 'ring'), eq('items.color', 'red'))],
        ['mixed root and relation', and(eq('items.title', 'book'), or(eq('items.color', 'red'), eq('id', 9)))],
        ['negated group over one path', not(and(eq('items.title', 'book'), eq('items.color', 'red')))],
        ['not(elemMatch) with a mixed record', not(elemMatch('items', and(eq('title', 'book'), eq('color', 'red'))))],
    ];

    sameElement.forEach(([name, condition]) => {
        it(`should bind to the same element for ${name}`, () => {
            const rows = [...records, ...split];

            const filters = new FiltersNode(FilterCompoundOperator.AND, [condition]);
            const { args } = new PrismaAdapter(createAdapterOptions()).execute(new Query({ filters }));

            const prisma = selectRows(args.where, rows)
                .map((record) => record.id)
                .sort((a, b) => a - b);
            const memory = rows
                .filter((record) => compileFilters(condition as Filter)(record))
                .map((record) => record.id)
                .sort((a, b) => a - b);

            expect(prisma).toEqual(memory);
        });
    });
});
