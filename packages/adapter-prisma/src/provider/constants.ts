/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ProviderOptions } from './types';

/**
 * Datasource providers a prisma schema can declare.
 */
export enum Provider {
    POSTGRESQL = 'postgresql',
    MYSQL = 'mysql',
    SQLITE = 'sqlite',
    SQLSERVER = 'sqlserver',
    MONGODB = 'mongodb',
    COCKROACHDB = 'cockroachdb',
}

/**
 * Capability preset per provider: the prisma counterpart of the
 * `@rapiq/adapter-sql` dialect presets.
 *
 * `mode: 'insensitive'` exists on the postgres family and mongodb
 * only. mysql and sqlserver compare case-insensitively under their
 * default collations, so nothing has to be emitted there. sqlite
 * supports neither: its `LIKE` is case-insensitive for ASCII, but
 * `equals` is not: a documented limitation rather than a silent
 * divergence.
 */
export const PROVIDERS : Record<`${Provider}`, ProviderOptions> = {
    [Provider.POSTGRESQL]: { caseInsensitiveMode: true },
    [Provider.COCKROACHDB]: { caseInsensitiveMode: true },
    [Provider.MONGODB]: { caseInsensitiveMode: true },
    [Provider.MYSQL]: { caseInsensitiveMode: false },
    [Provider.SQLSERVER]: { caseInsensitiveMode: false },
    [Provider.SQLITE]: { caseInsensitiveMode: false },
};
