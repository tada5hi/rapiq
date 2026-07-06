/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import { Realm } from './entity/realm';
import { Role } from './entity/role';
import { RoleDetail } from './entity/role-detail';
import { User } from './entity/user';

export function createDataSourceOptions() : DataSourceOptions {
    return {
        type: 'better-sqlite3',
        entities: [Role, RoleDetail, User, Realm],
        database: ':memory:',
        extra: { charset: 'UTF8_GENERAL_CI' },
    };
}

export function createMysqlDataSourceOptions() : DataSourceOptions {
    return {
        type: 'mysql',
        entities: [Role, RoleDetail, User, Realm],
        database: 'test',
    };
}

export function createDataSource(options?: DataSourceOptions) : DataSource {
    return new DataSource(options || createDataSourceOptions());
}

/**
 * Build entity metadata without opening a connection — enough for
 * query-builder SQL generation in dialect specs (no live database).
 */
export async function createUnconnectedDataSource(options?: DataSourceOptions) : Promise<DataSource> {
    const dataSource = createDataSource(options);

    await (dataSource as unknown as { buildMetadatas: () => Promise<void> }).buildMetadatas();

    return dataSource;
}
