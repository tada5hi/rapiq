/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Aggregate,
    Aggregates,
    ErrorCode,
    Group,
    Groups,
    Pagination,
    Query,
} from '@rapiq/core';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../../src';
import { User } from '../../data/entity/user';
import { createUnconnectedDataSource } from '../../data/factory';

const refusal = expect.objectContaining({ code: ErrorCode.FEATURE_UNSUPPORTED, feature: 'groups' });

describe('src/adapter/module.ts (grouped queries)', () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = await createUnconnectedDataSource();
    });

    it('should refuse a grouped query without touching the builder', () => {
        const queryBuilder = dataSource
            .getRepository(User)
            .createQueryBuilder('user');
        const before = queryBuilder.getQuery();

        const query = new Query({
            groups: new Groups([new Group({
                name: 'age',
                lowering: {
                    fn: undefined,
                    field: 'age',
                    args: [],
                },
            })]),
            pagination: new Pagination(10, 0),
        });

        expect(() => new TypeormAdapter({ queryBuilder }).execute(query)).toThrowError(refusal);
        expect(queryBuilder.getQuery()).toEqual(before);
        expect(queryBuilder.expressionMap.take).toBeUndefined();
    });

    it('should refuse a query with aggregates only', () => {
        const queryBuilder = dataSource
            .getRepository(User)
            .createQueryBuilder('user');

        const query = new Query({
            aggregates: new Aggregates([new Aggregate({
                name: 'count',
                lowering: {
                    fn: 'count',
                    field: undefined,
                    args: [],
                },
            })]),
        });

        expect(() => new TypeormAdapter({ queryBuilder }).execute(query)).toThrowError(refusal);
    });
});
