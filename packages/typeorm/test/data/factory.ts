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

const entities = [Role, RoleDetail, User, Realm];

/**
 * DataSource options for the live-database specs. Defaults to an in-memory
 * `better-sqlite3` database so `npm test` needs no external infrastructure.
 * The CI matrix opts into a real engine via `DB_TYPE` (`mysql` | `postgres`)
 * plus the `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE`
 * connection env vars — the same contract authup uses. `dropSchema` is set for
 * the persistent engines so each suite's `synchronize()` starts from a clean
 * schema (unlike sqlite `:memory:`, a real DB survives across spec files).
 */
export function createDataSourceOptions() : DataSourceOptions {
    const type = process.env.DB_TYPE;

    if (type === 'mysql' || type === 'postgres') {
        return {
            type,
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || (type === 'mysql' ? 3306 : 5432),
            username: process.env.DB_USERNAME || (type === 'mysql' ? 'root' : 'postgres'),
            password: process.env.DB_PASSWORD || 'start123',
            database: process.env.DB_DATABASE || 'test',
            entities,
            dropSchema: true,
        };
    }

    return {
        type: 'better-sqlite3',
        entities,
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
