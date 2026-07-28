/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Args, Where } from './types';

/**
 * Merge two prisma argument objects, treating `override` as a
 * NARROWING of `base` (prisma itself ships no args composition;
 * `$extends` intercepts every call globally, per-call merging is left
 * to the user):
 *
 * - `where` conditions are conjoined (`AND`), never substituted, so
 *   an application-owned tenant or authorization predicate survives,
 * - `select` and `include` stay mutually exclusive per prisma's
 *   rules: an overriding `select` replaces the baseline selection,
 *   while an overriding `include` JOINS a baseline `select` instead
 *   of replacing it (widening a caller-owned projection would expose
 *   columns the application chose to withhold),
 * - `orderBy`, `take` and `skip` follow the override when present,
 * - every other key (`cursor`, `distinct`, ...) passes through, the
 *   override winning on collisions.
 */
export function mergeArgs<T extends Args = Args>(base: T, override: Args) : T {
    const output = { ...base } as Args;

    const {
        where,
        select,
        include,
        orderBy,
        take,
        skip,
        ...rest
    } = override;

    Object.assign(output, rest);

    if (where) {
        output.where = base.where ?
            { AND: [base.where, where] } as Where :
            where;
    }

    if (select) {
        output.select = select;
        delete output.include;
        delete (output as Record<string, unknown>).omit;
    } else if (include) {
        if (base.select) {
            output.select = { ...base.select, ...include };
            delete output.include;
            delete (output as Record<string, unknown>).omit;
        } else {
            output.include = include;
            delete output.select;
        }
    }

    if (orderBy) {
        output.orderBy = orderBy;
    }

    if (typeof take !== 'undefined') {
        output.take = take;
    }

    if (typeof skip !== 'undefined') {
        output.skip = skip;
    }

    return output as T;
}
