/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, IConditionVisitor } from '../condition';

export interface IFiltersVisitor<R> {
    visitFilters(expr: IFilters): R;
}

export interface IFilters<
    T extends ICondition = ICondition,
> extends ICondition<T[]> {
    readonly operator: string;

    readonly value : T[];

    /**
     * Displaceability marker: a sealed group is never dropped by a
     * later {@link IFilters.merge} and never collapsed into its parent
     * by {@link IFilters.flatten}.
     */
    readonly sealed?: boolean;

    accept<R>(visitor: IFiltersVisitor<R>) : R;
    accept<R>(visitor: IConditionVisitor<R>) : R;

    /**
     * A copy of this group carrying the {@link IFilters.sealed} marker
     * (the receiver itself when it is already sealed). Reach for the
     * `seal` helper to seal any {@link ICondition}.
     */
    seal() : IFilters<T>;

    flatten(items?: T[]) : IFilters<T>;

    merge(other: IFilters) : IFilters;

    and(...conditions: ICondition[]) : IFilters;

    or(...conditions: ICondition[]) : IFilters;
}
