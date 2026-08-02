/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FindManyConfig, Where } from './types';

/**
 * Merge two drizzle config objects, treating `override` as a
 * NARROWING of `base`:
 *
 * - `where` conditions are conjoined (`AND`), never substituted, so
 *   an application-owned tenant or authorization predicate survives,
 * - an overriding `columns` replaces the baseline projection
 *   (widening a caller-owned projection would expose columns the
 *   application chose to withhold), while `with` entries JOIN the
 *   baseline ones, the override winning per relation,
 * - `orderBy`, `limit` and `offset` follow the override when present,
 * - every other key (`extras`, ...) passes through, the override
 *   winning on collisions.
 */
export function mergeConfig<T extends FindManyConfig = FindManyConfig>(
    base: T,
    override: FindManyConfig,
) : T {
    const output = { ...base } as FindManyConfig;

    const {
        where,
        columns,
        with: withEntries,
        orderBy,
        limit,
        offset,
        ...rest
    } = override;

    Object.assign(output, rest);

    if (where) {
        output.where = base.where ?
            { AND: [base.where, where] } as Where :
            where;
    }

    if (columns) {
        output.columns = columns;
    }

    if (withEntries) {
        output.with = base.with ?
            { ...base.with, ...withEntries } :
            withEntries;
    }

    if (orderBy) {
        output.orderBy = orderBy;
    }

    if (typeof limit !== 'undefined') {
        output.limit = limit;
    }

    if (typeof offset !== 'undefined') {
        output.offset = offset;
    }

    return output as T;
}
