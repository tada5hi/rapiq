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

    accept<R>(visitor: IFilterVisitor<R>) : R;
}
