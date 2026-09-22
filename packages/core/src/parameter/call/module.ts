/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { SortDirection } from '../../schema';
import type { IAggregate } from '../aggregates';
import type { IGroup } from '../groups';
import type { ISort } from '../sorts';
import { Sort } from '../sorts';
import type { IQuery } from '../types';

function isListEqual(a: readonly string[], b: readonly string[]) : boolean {
    return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Name, params (ordered) and lowering (fn, field, args) all equal.
 * An unresolved call (lowering undefined) only equals another unresolved one.
 */
export function isCallEqual(a: IGroup | IAggregate, b: IGroup | IAggregate) : boolean {
    if (a.name !== b.name || !isListEqual(a.params, b.params)) {
        return false;
    }

    if (!a.lowering || !b.lowering) {
        return a.lowering === b.lowering;
    }

    return a.lowering.fn === b.lowering.fn &&
        a.lowering.field === b.lowering.field &&
        isListEqual(a.lowering.args, b.lowering.args);
}

/**
 * The ordering every grouped consumer applies: the explicit sorts when
 * present, otherwise every group key ascending in declared order, and
 * none for an aggregates-only query (which yields exactly one row).
 */
export function resolveGroupedSorts(query: IQuery) : ISort[] {
    if (query.sorts.value.length > 0) {
        return query.sorts.value;
    }

    return (query.groups?.value ?? [])
        .map((group) => new Sort(group.key, SortDirection.ASC));
}
