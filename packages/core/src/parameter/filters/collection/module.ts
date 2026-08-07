/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator } from '../../../schema';
import type { ConditionOptions, ICondition } from '../condition';
import type { IFilters, IFiltersVisitor } from './types';
import { isFilters } from './check';

export class Filters<
    T extends ICondition = ICondition,
> implements IFilters<T> {
    readonly value: T[];

    readonly operator: string;

    readonly sealed?: boolean;

    constructor(
        operator: string,
        conditions: T[],
        options: ConditionOptions = {},
    ) {
        this.operator = operator;
        this.value = conditions;

        // only set when sealed, so an unsealed group stays
        // structurally identical to what earlier versions produced.
        if (options.sealed) {
            this.sealed = true;
        }
    }

    accept<R>(visitor: IFiltersVisitor<R>) : R {
        return visitor.visitFilters(this);
    }

    seal() : IFilters<T> {
        if (this.sealed) {
            return this;
        }

        return new Filters<T>(this.operator, this.value, { sealed: true });
    }

    flatten(aggregatedResult?: T[]) : IFilters<T> {
        // this.value.splice(0, this.value.length, ...next);

        return new Filters(
            this.operator,
            this.flattenInternal(this.value, this.operator, aggregatedResult),
            { sealed: this.sealed },
        );
    }

    protected flattenInternal<F extends ICondition>(
        conditions: F[],
        operator: string,
        aggregatedResult?: F[],
    ) {
        const flatConditions: F[] = aggregatedResult || [];

        for (const currentNode of conditions) {
            // merging same-operator children relies on associativity —
            // NOT groups are not associative (not(not(x)) ≠ not(x)) —
            // and a sealed group carries its protection in the node, so
            // hoisting its children would strip that protection.
            if (
                isFilters(currentNode, operator) &&
                operator !== FilterCompoundOperator.NOT &&
                !currentNode.sealed
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
     * in argument order. An unsealed root AND contributes its flattened
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
     * Wrap & inject (immutable): the given conditions are sealed and
     * combined with the receiver under an AND group. Sealed conditions
     * survive normalization ({@link Filters.flatten}), so a scoping
     * condition injected here remains an explicit conjunct.
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

        const injected = conditions.map(sealCondition);

        // an empty receiver constrains nothing, so it must not become a
        // child: under OR it would widen the group to everything.
        if (this.value.length === 0) {
            return new Filters(operator, injected);
        }

        // a receiver already carrying that operator contributes its
        // conditions directly (associativity), which keeps the group flat.
        if (
            this.operator === operator &&
            operator !== FilterCompoundOperator.NOT &&
            !this.sealed
        ) {
            return new Filters(operator, [...this.value, ...injected]);
        }

        return new Filters(operator, [this, ...injected]);
    }
}

/**
 * The `seal` helper, inlined for the conditions {@link Filters.and} /
 * {@link Filters.or} inject: reaching for the helper here would make
 * this module depend on one that depends back on it.
 */
function sealCondition(condition: ICondition) : ICondition {
    if (typeof condition.seal === 'function') {
        return condition.seal();
    }

    return condition;
}

/**
 * The conjuncts a {@link Filters.merge} operates on: the flattened
 * children of an unsealed root AND, or the whole node for a sealed tree
 * or any other compound operator.
 */
function toConjuncts(input: IFilters) : ICondition[] {
    if (
        input.operator === FilterCompoundOperator.AND &&
        !input.sealed
    ) {
        return input.flatten().value;
    }

    return [input];
}
