/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ISorts } from '@rapiq/core';
import { SortDirection } from '@rapiq/core';

/**
 * The `orderBy` argument as an **array** of single-key objects, the
 * only form in which prisma honors the order of multiple sort keys.
 *
 * Relation paths nest (`{ realm: { name: 'asc' } }`). Prisma can only
 * order by a to-one relation's scalar (a to-many supports `_count`
 * alone), so a to-many path is emitted as written and rejected by
 * prisma rather than silently reinterpreted. Duplicate keys keep
 * their first occurrence, mirroring the keyed collapse of the SQL
 * adapters.
 */
export function buildOrderBy(sorts: ISorts) : Record<string, any>[] {
    const output : Record<string, any>[] = [];
    const seen = new Set<string>();

    for (const sort of sorts.value) {
        if (seen.has(sort.name)) {
            continue;
        }

        seen.add(sort.name);

        const direction = sort.operator === SortDirection.DESC ? 'desc' : 'asc';
        const segments = sort.name.split('.');

        let entry : Record<string, any> = { [segments[segments.length - 1] as string]: direction };

        for (let i = segments.length - 2; i >= 0; i--) {
            entry = { [segments[i] as string]: entry };
        }

        output.push(entry);
    }

    return output;
}
