/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { Query } from './module';
import type { IQuery } from './types';

/**
 * Merge queries (the IR) with left priority — the first argument wins.
 * Fields, relations and sorts are keyed by name (first occurrence sets
 * value and position), pagination merges limit/offset independently and
 * filters use {@link IFilters.merge} (per-field replace, flat root-AND
 * trees only — a typed MergeError is thrown otherwise).
 *
 * Immutable — inputs stay untouched, a new {@link Query} is returned.
 */
export function mergeQueries(...input: IQuery[]) : Query {
    const [first, ...rest] = input;
    if (!first) {
        return new Query();
    }

    let {
        fields, 
        filters, 
        pagination, 
        relations, 
        sorts,
    } = first;

    for (const query of rest) {
        fields = fields.merge(query.fields);
        filters = filters.merge(query.filters);
        pagination = pagination.merge(query.pagination);
        relations = relations.merge(query.relations);
        sorts = sorts.merge(query.sorts);
    }

    return new Query({
        fields, 
        filters, 
        pagination, 
        relations, 
        sorts,
    });
}
