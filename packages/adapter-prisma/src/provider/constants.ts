/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, createFilterRegexPattern } from '@rapiq/core';
import type { ProviderOptions } from './types';

const escapeLike = (input: string) => input.replace(/[\\%_]/g, '\\$&');

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
    [Provider.POSTGRESQL]: { caseInsensitiveMode: true, escapeMatch: escapeLike },
    [Provider.COCKROACHDB]: { caseInsensitiveMode: true, escapeMatch: escapeLike },
    [Provider.MONGODB]: { caseInsensitiveMode: true, escapeMatch: createFilterRegexPattern },
    [Provider.MYSQL]: { caseInsensitiveMode: false, escapeMatch: escapeLike },
    [Provider.SQLSERVER]: {
        caseInsensitiveMode: false,
        escapeMatch: (input) => input.replace(/[%_[]/g, '[$&]'),
    },
    [Provider.SQLITE]: {
        caseInsensitiveMode: false,
        escapeMatch: (input) => {
            // SQLite LIKE has no default escape and Prisma exposes no ESCAPE.
            if (/[%_]/.test(input)) {
                throw AdapterError.featureUnsupported('filters:match-literal');
            }
            return input;
        },
    },
};
