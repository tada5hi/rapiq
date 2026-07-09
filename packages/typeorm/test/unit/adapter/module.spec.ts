/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Pagination, Query } from '@rapiq/core';
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

        const adapter = new TypeormAdapter({ queryBuilder });

        const output = adapter.execute(new Query({ pagination: new Pagination(10, 20) }));

        expect(output.pagination).toEqual({ limit: 10, offset: 20 });
        expect(queryBuilder.expressionMap.take).toEqual(10);
        expect(queryBuilder.expressionMap.skip).toEqual(20);
    });

    it('should return unset pagination values when none apply', () => {
        const queryBuilder = dataSource
            .getRepository(User)
            .createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder });

        const output = adapter.execute(new Query());

        expect(output.pagination).toEqual({ limit: undefined, offset: undefined });
    });

    it('should reset stale pagination on a re-run whose query drops it', () => {
        const queryBuilder = dataSource
            .getRepository(User)
            .createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder });

        // first run applies take/skip to the builder
        adapter.execute(new Query({ pagination: new Pagination(10, 20) }));
        expect(queryBuilder.expressionMap.take).toEqual(10);

        // default clear:true makes the adapter re-runnable — a follow-up query
        // without pagination must reset the builder, not leak the prior limit/offset
        adapter.execute(new Query());
        expect(queryBuilder.expressionMap.take).toBeUndefined();
        expect(queryBuilder.expressionMap.skip).toBeUndefined();
    });
});
