/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../../src';
import { User } from '../../data/entity/user';
import { createUnconnectedDataSource } from '../../data/factory';

describe('src/adapter/module.ts', () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = await createUnconnectedDataSource();
    });

    it('should return the applied pagination', () => {
        const queryBuilder = dataSource
            .getRepository(User)
            .createQueryBuilder('user');

        const adapter = new TypeormAdapter();
        adapter.withQuery(queryBuilder);
        adapter.pagination.setLimit(10);
        adapter.pagination.setOffset(20);

        const output = adapter.execute();

        expect(output.pagination).toEqual({ limit: 10, offset: 20 });
        expect(queryBuilder.expressionMap.take).toEqual(10);
        expect(queryBuilder.expressionMap.skip).toEqual(20);
    });

    it('should return undefined pagination when none applies', () => {
        const queryBuilder = dataSource
            .getRepository(User)
            .createQueryBuilder('user');

        const adapter = new TypeormAdapter();
        adapter.withQuery(queryBuilder);

        const output = adapter.execute();

        expect(output.pagination).toEqual({ limit: undefined, offset: undefined });
    });
});
