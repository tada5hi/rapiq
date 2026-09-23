/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { AdapterError } from '../../errors';
import { SortDirection } from '../../schema';
import type { IAggregate } from '../aggregates';
import type { IGroup } from '../groups';
import type { ISort } from '../sorts';
import { Sort } from '../sorts';
import { isGroupedQuery } from '../check';
import type { IQuery } from '../types';
import { BucketUnit } from './constants';

const BUCKET_UNITS : string[] = Object.values(BucketUnit);

/**
 * Whether the input is one of the closed {@link BucketUnit} values, the
 * only units an adapter may inline into a statement.
 */
export function isBucketUnit(input: unknown) : input is `${BucketUnit}` {
    return typeof input === 'string' && BUCKET_UNITS.includes(input);
}

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
 * The refusals every grouped entry point shares, run before any SQL is
 * rendered or any record is read: a query without groups or aggregates
 * (`groups:empty`), one carrying fields (`fields:grouped`) and one
 * writing a row key twice (`KEY_AMBIGUOUS`). The parser never produces
 * the last two; a hand-built query could.
 */
export function assertGroupedQuery(query: IQuery) : void {
    if (!isGroupedQuery(query)) {
        throw AdapterError.featureUnsupported('groups:empty');
    }

    if (query.fields.value.length > 0) {
        throw AdapterError.featureUnsupported('fields:grouped');
    }

    const keys = new Set<string>();
    for (const item of [...(query.groups?.value ?? []), ...(query.aggregates?.value ?? [])]) {
        if (keys.has(item.key)) {
            throw AdapterError.outputKeyDuplicate(item.key);
        }

        keys.add(item.key);
    }
}

/**
 * The ordering every grouped consumer applies: the explicit sorts, then
 * every group key they do not name ascending in declared order, and
 * none for an aggregates-only query (which yields exactly one row). The
 * group keys identify a row, so the order is total and LIMIT/OFFSET
 * paging over ties in the explicit sorts is stable.
 *
 * A grouped row carries only the output keys, so an explicit sort naming
 * anything else is refused (`sorts:grouped`). The parser never produces
 * one; a hand-built query could, and a backend would otherwise render
 * the name raw or ignore it.
 */
export function resolveGroupedSorts(query: IQuery) : ISort[] {
    const groups = query.groups?.value ?? [];
    const keys = new Set<string>([
        ...groups.map((group) => group.key),
        ...(query.aggregates?.value ?? []).map((aggregate) => aggregate.key),
    ]);

    if (query.sorts.value.some((sort) => !keys.has(sort.name))) {
        throw AdapterError.featureUnsupported('sorts:grouped');
    }

    const named = new Set(query.sorts.value.map((sort) => sort.name));

    return [
        ...query.sorts.value,
        ...groups
            .filter((group) => !named.has(group.key))
            .map((group) => new Sort(group.key, SortDirection.ASC)),
    ];
}
