/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ISorts } from '@rapiq/core';
import { AdapterError, SortDirection } from '@rapiq/core';

/**
 * The `orderBy` argument as a single object whose key order carries
 * the sort priority (drizzle iterates the object's own insertion
 * order).
 *
 * The relational API orders the root query by its own columns only:
 * a dotted relation path fails typed instead of being emitted as an
 * undocumented shape drizzle might silently ignore. Duplicate keys
 * keep their first occurrence, mirroring the keyed collapse of the
 * SQL adapters.
 */
export function buildOrderBy(sorts: ISorts) : Record<string, 'asc' | 'desc'> {
    const output : Record<string, 'asc' | 'desc'> = {};

    for (const sort of sorts.value) {
        if (sort.name.includes('.')) {
            throw AdapterError.featureUnsupported('sort:relation');
        }

        if (typeof output[sort.name] !== 'undefined') {
            continue;
        }

        output[sort.name] = sort.operator === SortDirection.DESC ? 'desc' : 'asc';
    }

    return output;
}
