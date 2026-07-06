/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DialectOptions } from '@rapiq/sql';
import { pg, resolveDialect } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';

/**
 * Resolve the {@link DialectOptions} preset matching the bound query
 * builder's connection type. The postgres preset is the documented
 * last-resort default when no query builder is bound (yet) or the
 * connection type has no matching preset.
 */
export function resolveQueryDialect(
    query?: SelectQueryBuilder<any>,
) : DialectOptions {
    if (query) {
        const dialect = resolveDialect(query.connection.options.type);
        if (dialect) {
            return dialect;
        }
    }

    return pg;
}
