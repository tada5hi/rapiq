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
import { User } from './entity/user';

export function createDataSourceOptions() : DataSourceOptions {
    return {
        type: 'better-sqlite3',
        entities: [Role, User, Realm],
        database: ':memory:',
        extra: {
            charset: 'UTF8_GENERAL_CI',
        },
    };
}

export function createDataSource(options?: DataSourceOptions) : DataSource {
    return new DataSource(options || createDataSourceOptions());
}
