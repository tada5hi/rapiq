/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DataSource } from 'typeorm';
import { isTransactionActive } from '../../../src/typeorm';
import { RealmEntity } from '../../data/entity';
import { createDataSource } from '../../data/factory';

describe('src/typeorm/transaction.ts', () => {
    let dataSource : DataSource;

    beforeEach(async () => {
        dataSource = await createDataSource();
    });

    afterEach(async () => {
        await dataSource.destroy();
    });

    it('should report no transaction outside of one', () => {
        expect(isTransactionActive(dataSource)).toBeFalsy();
        expect(isTransactionActive(dataSource, dataSource.manager)).toBeFalsy();
    });

    it('should report the transaction of the transactional manager', async () => {
        await dataSource.transaction(async (manager) => {
            expect(isTransactionActive(dataSource, manager)).toBeTruthy();
        });
    });

    it('should report an open transaction on the shared better-sqlite3 runner without a manager', async () => {
        await dataSource.transaction(async (manager) => {
            await manager.getRepository(RealmEntity).save({ id: 'x', name: 'master' });

            expect(isTransactionActive(dataSource)).toBeTruthy();
            expect(isTransactionActive(dataSource, dataSource.manager)).toBeTruthy();
        });
    });

    it('should report no transaction after a commit', async () => {
        await dataSource.transaction(async () => {});

        expect(isTransactionActive(dataSource)).toBeFalsy();
    });

    it('should report no transaction after a rollback', async () => {
        const failure = new Error('rollback');

        await expect(dataSource.transaction(async () => {
            throw failure;
        })).rejects.toBe(failure);

        expect(isTransactionActive(dataSource)).toBeFalsy();
    });

    it('should follow a manually created query runner', async () => {
        const queryRunner = dataSource.createQueryRunner();

        expect(isTransactionActive(dataSource, queryRunner.manager)).toBeFalsy();

        await queryRunner.startTransaction();

        expect(isTransactionActive(dataSource, queryRunner.manager)).toBeTruthy();
        expect(isTransactionActive(dataSource)).toBeTruthy();

        await queryRunner.rollbackTransaction();

        expect(isTransactionActive(dataSource, queryRunner.manager)).toBeFalsy();
        expect(isTransactionActive(dataSource)).toBeFalsy();
    });

    it('should never allocate a query runner on a pooled driver', () => {
        const pooled = new DataSource({ type: 'postgres' });
        const spy = vi.spyOn(pooled, 'createQueryRunner');

        expect(isTransactionActive(pooled)).toBeFalsy();
        expect(isTransactionActive(pooled, pooled.manager)).toBeFalsy();
        expect(spy).not.toHaveBeenCalled();
    });
});
