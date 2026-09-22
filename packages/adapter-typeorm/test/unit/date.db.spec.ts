/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    ErrorCode,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    Query,
} from '@rapiq/core';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';
import { createUserSeed } from '../data/seeder/user';

const LATE = '2026-08-23T10:16:44.000Z';

/**
 * The UTC wall clock of the seeded instants, i.e. the form a zone-less
 * column stores them in. The fixture writes it as a raw expression
 * rather than through `repository.save()` on purpose: typeorm's pg and
 * mysql drivers hand a bound `Date` to the driver, which serializes it
 * in the HOST's zone, so a `save()`-seeded row would carry local wall
 * clock and the spec would measure that quirk instead of the adapter's
 * contract (a zone-less column means UTC).
 */
const STORED : Record<string, string> = {
    Caleb: '2026-08-20 09:00:00.000',
    Aston: '2026-08-23 10:16:44.000',
};

describe('src/adapter/filters (date columns)', () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const users = await createUserSeed(dataSource);

        for (const user of users) {
            await dataSource.createQueryBuilder()
                .update(User)
                .set({ created_at: () => ':storedAt' })
                .where('id = :id', { id: user.id })
                .setParameter('storedAt', STORED[user.first_name])
                .execute();
        }
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    const createQueryBuilder = (condition: Filter) => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder });
        adapter.execute(new Query({ filters: new Filters(FilterCompoundOperator.AND, [condition]) }));

        return queryBuilder;
    };

    it('should select the window a wire date range describes', async () => {
        const queryBuilder = createQueryBuilder(new Filter(
            FilterFieldOperator.GREATER_THAN_EQUAL,
            'created_at',
            '2026-08-23T00:00:00.000Z',
        ));

        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
        expect(data[0].first_name).toEqual('Aston');
    });

    it('should select the complement window', async () => {
        const queryBuilder = createQueryBuilder(new Filter(
            FilterFieldOperator.LESS_THAN,
            'created_at',
            '2026-08-23T00:00:00.000Z',
        ));

        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
        expect(data[0].first_name).toEqual('Caleb');
    });

    it('should match the exact instant the api returned', async () => {
        const queryBuilder = createQueryBuilder(new Filter(
            FilterFieldOperator.EQUAL,
            'created_at',
            LATE,
        ));

        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
        expect(data[0].first_name).toEqual('Aston');
    });

    it('should accept a date instance as well as a wire string', async () => {
        const queryBuilder = createQueryBuilder(new Filter(
            FilterFieldOperator.GREATER_THAN_EQUAL,
            'created_at',
            new Date('2026-08-23T00:00:00.000Z'),
        ));

        const data = await queryBuilder.getMany();

        expect(data.length).toEqual(1);
    });

    it('should bind the storage literal rather than a date instance', () => {
        const queryBuilder = createQueryBuilder(new Filter(
            FilterFieldOperator.GREATER_THAN_EQUAL,
            'created_at',
            '2026-08-23T10:16:44.000Z',
        ));

        const [, parameters] = queryBuilder.getQueryAndParameters();

        expect(parameters).toEqual(['2026-08-23 10:16:44.000']);
    });

    it('should leave a non-date column untouched', () => {
        const queryBuilder = createQueryBuilder(new Filter(
            FilterFieldOperator.EQUAL,
            'address',
            '2026-08-23T10:16:44.000Z',
        ));

        const [, parameters] = queryBuilder.getQueryAndParameters();

        expect(parameters).toEqual(['2026-08-23T10:16:44.000Z']);
    });

    it('should refuse a value which denotes no instant', () => {
        expect(() => createQueryBuilder(new Filter(
            FilterFieldOperator.EQUAL,
            'created_at',
            'yesterday',
        ))).toThrowError(expect.objectContaining({ code: ErrorCode.KEY_VALUE_INVALID }));

        expect(() => createQueryBuilder(new Filter(
            FilterFieldOperator.EQUAL,
            'created_at',
            'yesterday',
        ))).toThrowError(AdapterError);
    });
});
