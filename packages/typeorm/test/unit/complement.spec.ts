/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Filter } from '@rapiq/core';
import {
    FilterCompoundOperator,
    Filters,
    Query,
    contains,
    endsWith,
    eq,
    exists,
    inArray,
    ne,
    nin,
    notContains,
    notEndsWith,
    notStartsWith,
    startsWith,
} from '@rapiq/core';
import { compileFilters } from '@rapiq/memory';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';

describe('cross-adapter complement law (memory vs typeorm)', () => {
    let dataSource : DataSource;

    let records : User[];

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const repository = dataSource.getRepository(User);
        await repository.save([
            {
                first_name: 'Caleb',
                last_name: 'Barrows',
                age: 18,
                address: 'Hogwarts',
                email: 'caleb.barrows@gmail.com',
            },
            {
                first_name: 'Aston',
                last_name: 'Nel',
                age: 60,
                email: 'ashton.nel@gmail.com',
            },
            {
                first_name: 'Frodo',
                last_name: 'Baggins',
                age: 33,
                address: 'Mordor',
                email: 'frodo.baggins@gmail.com',
            },
        ]);

        records = await repository.find();
    });

    const fetchIds = async (condition: Filter) : Promise<number[]> => {
        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder });
        adapter.execute(new Query({ filters: new Filters(FilterCompoundOperator.AND, [condition]) }));

        const data = await queryBuilder.getMany();
        return data.map((user) => user.id).sort((a, b) => a - b);
    };

    const evaluateIds = (condition: Filter) : number[] => {
        const predicate = compileFilters(condition);

        return records
            .filter((record) => predicate(record))
            .map((user) => user.id)
            .sort((a, b) => a - b);
    };

    // the complement-law matrix pinned by @rapiq/memory, replayed against
    // the live database: address is 'Hogwarts', NULL and 'Mordor'.
    const pairs : [string, Filter, Filter][] = [
        ['eq/ne', eq('address', 'Hogwarts'), ne('address', 'Hogwarts')],
        ['eq/ne (null)', eq('address', null), ne('address', null)],
        ['in/nin', inArray('address', ['Hogwarts', 'Mordor']), nin('address', ['Hogwarts', 'Mordor'])],
        ['in/nin (null element)', inArray('address', ['Hogwarts', null]), nin('address', ['Hogwarts', null])],
        ['in/nin (empty)', inArray('address', []), nin('address', [])],
        ['contains/notContains', contains('address', 'wart'), notContains('address', 'wart')],
        ['startsWith/notStartsWith', startsWith('address', 'Hog'), notStartsWith('address', 'Hog')],
        ['endsWith/notEndsWith', endsWith('address', 'arts'), notEndsWith('address', 'arts')],
        ['exists true/false', exists('address'), exists('address', false)],
    ];

    pairs.forEach(([name, positive, negative]) => {
        it(`should agree for ${name}`, async () => {
            const positiveIds = await fetchIds(positive);
            const negativeIds = await fetchIds(negative);

            expect(positiveIds).toEqual(evaluateIds(positive));
            expect(negativeIds).toEqual(evaluateIds(negative));

            // the negation selects exactly the remaining records.
            const allIds = records.map((user) => user.id).sort((a, b) => a - b);
            expect([...positiveIds, ...negativeIds].sort((a, b) => a - b)).toEqual(allIds);
        });
    });
});
