/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator } from '../../../schema';
import { Condition } from '../condition';
import type { ConditionOptions, ICondition } from '../condition';
import type { IFilters, IFiltersVisitor } from './types';
import { isFilters } from './check';

export class Filters<
    T extends ICondition = ICondition,
> extends Condition<T[]> implements IFilters<T> {
    readonly preserved?: boolean;

    constructor(
        operator: string,
        conditions: T[],
        options: ConditionOptions = {},
    ) {
        super(operator, conditions);

        if (options.preserved) {
            this.preserved = true;
        }
    }

    accept<R>(visitor: IFiltersVisitor<R>) : R {
        return visitor.visitFilters(this);
    }

    flatten(aggregatedResult?: T[]) : IFilters<T> {
        // this.value.splice(0, this.value.length, ...next);

        return new Filters(
            this.operator,
            this.flattenInternal(this.value, this.operator, aggregatedResult),
            { preserved: this.preserved },
        );
    }

    protected flattenInternal<F extends ICondition>(
        conditions: F[],
        operator: string,
        aggregatedResult?: F[],
    ) {
        const flatConditions: F[] = aggregatedResult || [];

        for (const currentNode of conditions) {
            // Merging same-operator children relies on associativity.
            // NOT groups are not associative (not(not(x)) is not not(x)).
            // A preserved group stays atomic so pruning protection remains.
            if (
                isFilters(currentNode, operator) &&
                operator !== FilterCompoundOperator.NOT &&
                !currentNode.preserved
            ) {
                currentNode.flatten(flatConditions);
            } else {
                flatConditions.push(currentNode);
            }
        }

        return flatConditions;
    }

    /**
     * Ordered logical conjunction. Each condition from both sides survives
     * in argument order. A non-preserved root AND contributes its flattened
     * child conjuncts, while every other root remains one conjunct.
     */
    merge(other: IFilters) : IFilters {
        if (this.value.length === 0) {
            return other;
        }

        if (other.value.length === 0) {
            return this;
        }

        return new Filters(FilterCompoundOperator.AND, [
            ...toConjuncts(this),
            ...toConjuncts(other),
        ]);
    }

    /**
     * Wrap and append immutably: combine the given conditions with the
     * receiver under an AND group while retaining their object identity.
     */
    and(...conditions: ICondition[]) : IFilters {
        return this.wrap(FilterCompoundOperator.AND, conditions);
    }

    /**
     * Wrap & inject (immutable), OR variant of {@link Filters.and}.
     */
    or(...conditions: ICondition[]) : IFilters {
        return this.wrap(FilterCompoundOperator.OR, conditions);
    }

    protected wrap(operator: string, conditions: ICondition[]) : IFilters {
        if (conditions.length === 0) {
            return this;
        }

        // an empty receiver constrains nothing, so it must not become a
        // child: under OR it would widen the group to everything.
        if (this.value.length === 0) {
            return new Filters(operator, conditions);
        }

        // a receiver already carrying that operator contributes its
        // conditions directly (associativity), which keeps the group flat.
        if (
            this.operator === operator &&
            operator !== FilterCompoundOperator.NOT &&
            !this.preserved
        ) {
            return new Filters(operator, [...this.value, ...conditions]);
        }

        return new Filters(operator, [this, ...conditions]);
    }
}

/**
 * The conjuncts a {@link Filters.merge} operates on: the flattened
 * children of a non-preserved root AND, or the whole node for a preserved
 * tree or any other compound operator.
 */
function toConjuncts(input: IFilters) : ICondition[] {
    if (
        input.operator === FilterCompoundOperator.AND &&
        !input.preserved
    ) {
        return input.flatten().value;
    }

    return [input];
}
