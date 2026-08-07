/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator } from '../../../schema';
import type { ICondition } from '../condition';

/**
 * The leaf-condition visitor. Operator semantics live in the plan
 * layer: consume {@link planCondition} via {@link interpretPlan}
 * (or a serializer over {@link distributeNegation}) instead of
 * branching on operator names here. The broad leaf input admits every
 * operator and value specialization.
 */
export interface IFilterVisitor<R> {
    visitFilter(expr: IFilter<string, unknown>): R;
}

export interface IFilter<
    OPERATOR extends string = `${FilterFieldOperator}`,
    VALUE = unknown,
> extends ICondition<VALUE> {
    readonly field : string;

    readonly operator : string | OPERATOR;

    readonly value: VALUE;

    /**
     * Relation-pruning protection marker. A preserved leaf must not be
     * discarded when a relation validator rejects a path it traverses.
     */
    readonly preserved?: true;

    /**
     * Displaceability marker: a sealed leaf is never dropped by a
     * later `merge` and never hoisted out of its group by `flatten`.
     */
    readonly sealed?: boolean;

    accept<R>(visitor: IFilterVisitor<R>) : R;

    /**
     * A copy of this leaf carrying the {@link IFilter.sealed} marker
     * (the receiver itself when it is already sealed). Reach for the
     * `seal` helper to seal any {@link ICondition}; both methods expose
     * interface types rather than concrete implementations.
     */
    seal() : IFilter<OPERATOR, VALUE>;
}
