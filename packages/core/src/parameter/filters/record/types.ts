/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator } from '../../../schema';

/**
 * The leaf-condition visitor. Operator semantics live in the plan
 * layer: consume {@link planCondition} via {@link interpretPlan}
 * (or a serializer over {@link distributeNegation}) instead of
 * branching on operator names here.
 */
export interface IFilterVisitor<R> {
    visitFilter(expr: IFilter): R;
}

export interface IFilter<
    OPERATOR extends string = `${FilterFieldOperator}`,
    VALUE = unknown,
> {
    readonly field : string;

    readonly operator : string | OPERATOR;

    readonly value: VALUE;

    /**
     * Displaceability marker: a sealed leaf is never dropped by a
     * later `merge` and never hoisted out of its group by `flatten`.
     */
    readonly sealed?: boolean;

    accept<R>(visitor: IFilterVisitor<R>) : R;

    /**
     * A copy of this leaf carrying the {@link IFilter.sealed} marker
     * (the receiver itself when it is already sealed). Reach for the
     * `seal` helper to seal a condition of either kind — it keeps the
     * argument's own type, which this self-reference cannot: naming the
     * parameters here would make them invariant and cut every
     * `Filter<OPERATOR, VALUE>` off from the visitor contract.
     */
    seal() : IFilter;
}
