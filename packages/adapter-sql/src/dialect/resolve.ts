/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { mssql } from './mssql';
import { mysql } from './mysql';
import { oracle } from './oracle';
import { pg } from './pg';
import { sqlite } from './sqlite';
import type { DialectOptions } from './types';

const presets : Record<string, DialectOptions> = {
    // postgres family
    pg,
    postgres: pg,
    postgresql: pg,
    'aurora-postgres': pg,
    cockroachdb: pg,

    // mysql family
    mysql,
    mysql2: mysql,
    mariadb: mysql,
    'aurora-mysql': mysql,

    // sqlite family (embedded drivers share sqlite semantics)
    sqlite,
    sqlite3: sqlite,
    'better-sqlite3': sqlite,
    sqljs: sqlite,
    capacitor: sqlite,
    cordova: sqlite,
    'react-native': sqlite,
    nativescript: sqlite,
    expo: sqlite,

    // others
    mssql,
    oracle,
    oracledb: oracle,
};

/**
 * Resolve a driver/connection type name (e.g. TypeORM's
 * `connection.options.type` or a knex client name) to the
 * matching {@link DialectOptions} preset.
 */
export function resolveDialect(name: string) : DialectOptions | undefined {
    return presets[name.toLowerCase()];
}
