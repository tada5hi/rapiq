/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator } from '../../../schema';
import type { Condition, ConditionOptions, ICondition } from '../condition';
import { isFilter } from '../record';
import type { IFilters, IFiltersVisitor } from './types';
import { isFilters } from './check';

export class Filters<
    T extends Condition = Condition,
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

        return new Filters(this.operator, this.value, { sealed: true });
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
     * Per-field replace (left/receiver priority): a conjunct of the other
     * side is dropped when the receiver already constrains the same field.
     * Only displaceable leaf conditions take part — a sealed condition and
     * a nested group are inert: never displaced, never dropped, carried
     * through as they are. A root that is not a displaceable AND counts as
     * one such group, which makes the operation total. Every conjunct of
     * the receiver survives into the result, so the outcome is never wider
     * than the receiver; only the other side can lose conditions, which is
     * what per-field replace is for.
     */
    merge(other: IFilters) : IFilters {
        if (this.value.length === 0) {
            return other;
        }

        if (other.value.length === 0) {
            return this;
        }

        const left = toConjuncts(this);

        const seen = new Set<string>();
        for (const condition of left) {
            if (isFilter(condition)) {
                seen.add(condition.field);
            }
        }

        const output : ICondition[] = [...left];
        for (const condition of toConjuncts(other)) {
            if (
                isFilter(condition) &&
                !condition.sealed &&
                seen.has(condition.field)
            ) {
                continue;
            }

            output.push(condition);
        }

        return new Filters(FilterCompoundOperator.AND, output);
    }

    /**
     * Wrap & inject (immutable): the given conditions are sealed and
     * combined with the receiver under an AND group. Sealed conditions
     * survive both normalization ({@link Filters.flatten}) and later
     * replace-merges ({@link Filters.merge}), so a scoping condition
     * injected here cannot be displaced by anything composed afterwards.
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
        // conditions directly (associativity), which keeps the group flat
        // and its own conditions displaceable by a later merge.
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
    if (isFilters(condition) || isFilter(condition)) {
        return condition.seal();
    }

    return condition;
}

/**
 * The conjuncts a {@link Filters.merge} operates on: the children of a
 * displaceable root-AND, or the whole node — a group, a sealed tree, any
 * other compound operator — as one inert conjunct.
 */
function toConjuncts(input: IFilters) : ICondition[] {
    if (
        input.operator === FilterCompoundOperator.AND &&
        !input.sealed
    ) {
        return input.value;
    }

    return [input];
}
