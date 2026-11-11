/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSource, EntityManager, QueryRunner } from 'typeorm';

/**
 * The drivers built on TypeORM's `AbstractSqliteDriver`: each holds one
 * query runner (`driver.queryRunner`) that every `createQueryRunner()`
 * call hands back, so a transaction opened anywhere is open on every read.
 */
const SHARED_RUNNER_DRIVERS = new Set<string>([
    'better-sqlite3',
    'capacitor',
    'cordova',
    'expo',
    'nativescript',
    'react-native',
    'sqljs',
]);

/**
 * Whether a read through `manager` (default: the data source's manager)
 * runs inside an open transaction, so it must bypass the cache: its
 * result may hold writes that are not committed, and their tags are not
 * bumped until the commit.
 *
 * On a pooled driver only the manager's own query runner can carry the
 * transaction. On a driver sharing one connection (the sqlite family) the
 * shared runner is read directly: it is never allocated, and never
 * released, here.
 */
export function isTransactionActive(dataSource: DataSource, manager?: EntityManager) : boolean {
    if ((manager ?? dataSource.manager).queryRunner?.isTransactionActive) {
        return true;
    }

    if (!SHARED_RUNNER_DRIVERS.has(dataSource.options.type)) {
        return false;
    }

    const { queryRunner } = dataSource.driver as { queryRunner?: QueryRunner };

    return !!queryRunner?.isTransactionActive;
}
