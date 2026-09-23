/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
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

const ID = '5b1d3c4e-8f2a-4b6c-9d0e-1f2a3b4c5d6e';

describe('src/adapter/filters (uuid columns)', () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        await createUserSeed(dataSource);
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    const createQueryBuilder = (condition: Filter) => {
        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder });
        adapter.execute(new Query({ filters: new Filters(FilterCompoundOperator.AND, [condition]) }));

        return queryBuilder;
    };

    const invalid = expect.objectContaining({ code: ErrorCode.KEY_VALUE_INVALID });

    it('should select by a uuid operand', async () => {
        const data = await createQueryBuilder(new Filter(FilterFieldOperator.EQUAL, 'external_id', ID))
            .getMany();

        expect(data.map((user) => user.first_name)).toEqual(['Aston']);
    });

    it('should read the braced and hyphen-less spellings postgres accepts', async () => {
        for (const operand of [`{${ID}}`, ID.replace(/-/g, '')]) {
            const data = await createQueryBuilder(new Filter(FilterFieldOperator.EQUAL, 'external_id', operand))
                .getMany();

            expect(data.map((user) => user.first_name)).toEqual(['Aston']);
        }
    });

    it('should refuse a non-uuid operand before the query runs', () => {
        expect(() => createQueryBuilder(new Filter(FilterFieldOperator.EQUAL, 'external_id', 'nope')))
            .toThrowError(invalid);
        expect(() => createQueryBuilder(new Filter(FilterFieldOperator.EQUAL, 'external_id', `${ID}0`)))
            .toThrowError(invalid);
        expect(() => createQueryBuilder(new Filter(FilterFieldOperator.NOT_EQUAL, 'external_id', 42)))
            .toThrowError(invalid);
    });

    it('should check every member of an in list', () => {
        expect(() => createQueryBuilder(new Filter(FilterFieldOperator.IN, 'external_id', [ID, 'nope'])))
            .toThrowError(invalid);
        expect(() => createQueryBuilder(new Filter(FilterFieldOperator.NOT_IN, 'external_id', [ID, 'nope'])))
            .toThrowError(invalid);
    });

    it('should accept null members of an in list', async () => {
        const data = await createQueryBuilder(new Filter(FilterFieldOperator.IN, 'external_id', [ID, null]))
            .getMany();

        expect(data.length).toEqual(2);
    });

    it('should leave a pattern operand alone', async () => {
        const data = await createQueryBuilder(new Filter(FilterFieldOperator.STARTS_WITH, 'external_id', '5b1d'))
            .getMany();

        expect(data.map((user) => user.first_name)).toEqual(['Aston']);
    });
});
