/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '../condition';

export interface IFiltersVisitor<R> {
    visitFilters(expr: IFilters): R;
}

export interface IFilters<
    T extends ICondition = ICondition,
> extends ICondition<T[]> {
    readonly operator: string;

    readonly value : T[];

    /**
     * Relation-pruning protection marker. A preserved group stays atomic
     * during normalization and pruning applies its contract to the subtree.
     */
    readonly preserved?: true;

    accept<R>(visitor: IFiltersVisitor<R>) : R;

    flatten(items?: T[]) : IFilters<T>;

    /**
     * Combine both groups as an ordered logical AND. Empty groups are the
     * identity; every condition from either non-empty group is retained.
     */
    merge(other: IFilters) : IFilters;

    and(...conditions: ICondition[]) : IFilters;

    or(...conditions: ICondition[]) : IFilters;
}
