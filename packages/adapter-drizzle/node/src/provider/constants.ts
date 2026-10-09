/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ProviderOptions } from './types';

/**
 * Database dialects drizzle can execute a relational query against.
 */
export enum Provider {
    PG = 'pg',
    MYSQL = 'mysql',
    SQLITE = 'sqlite',
}

/**
 * Capability preset per dialect: the drizzle counterpart of the
 * `@rapiq/adapter-sql` dialect presets.
 *
 * `ilike` exists on postgres only. mysql compares case-insensitively
 * under its default `*_ci` collations, so plain operators already
 * satisfy the case contract. sqlite folds ASCII case in `LIKE` but
 * not in `=`: a documented limitation rather than a silent
 * divergence, mirroring `@rapiq/adapter-prisma`'s sqlite row.
 *
 * `likeEscape`: postgres and mysql escape `%`/`_` with a backslash by
 * default; sqlite's `LIKE` has no default escape character and the
 * relational filter object offers no `ESCAPE` clause.
 */
export const PROVIDERS : Record<`${Provider}`, ProviderOptions> = {
    [Provider.PG]: { caseInsensitiveLike: true, likeEscape: true },
    [Provider.MYSQL]: { caseInsensitiveLike: false, likeEscape: true },
    [Provider.SQLITE]: { caseInsensitiveLike: false, likeEscape: false },
};
