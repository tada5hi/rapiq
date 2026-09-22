/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { MergeError } from '../errors';
import type { IAggregates } from './aggregates';
import { Aggregates } from './aggregates';
import type { IGroups } from './groups';
import { Groups } from './groups';
import { Query } from './module';
import type { IQuery } from './types';

/**
 * Merge queries (the IR). Fields, relations and sorts have left priority:
 * the first occurrence sets value and position. Pagination merges
 * limit/offset independently. Filters use {@link IFilters.merge} as an
 * ordered logical AND, retaining every condition. Groups keep the grain
 * of whichever side declares one and throw a typed MergeError when both
 * declare different ones. Aggregates follow the same rule, and a group
 * key equal to an aggregate key throws a typed MergeError. An absent
 * member of an external IQuery reads as empty.
 *
 * Immutable: inputs stay untouched, a new {@link Query} is returned.
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

    let groups : IGroups = first.groups ?? new Groups();
    let aggregates : IAggregates = first.aggregates ?? new Aggregates();

    for (const query of rest) {
        fields = fields.merge(query.fields);
        filters = filters.merge(query.filters);
        pagination = pagination.merge(query.pagination);
        relations = relations.merge(query.relations);
        sorts = sorts.merge(query.sorts);
        groups = groups.merge(query.groups ?? new Groups());
        aggregates = aggregates.merge(query.aggregates ?? new Aggregates());
    }

    // Each side may be sound on its own while the union is not: a group
    // and an aggregate of one key would write the same row key.
    const keys = new Set<string>();
    for (const item of [...groups.value, ...aggregates.value]) {
        if (keys.has(item.key)) {
            throw MergeError.outputKeyDuplicate(item.key);
        }

        keys.add(item.key);
    }

    return new Query({
        fields,
        filters,
        pagination,
        relations,
        sorts,
        groups,
        aggregates,
    });
}
