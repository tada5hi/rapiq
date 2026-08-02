/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { MergeError } from '../../../errors';
import { FilterCompoundOperator } from '../../../schema';
import type { Condition, ICondition } from '../condition';
import type { IFilter } from '../record';
import { isFilter } from '../record';
import type { IFilters, IFiltersVisitor } from './types';
import { isFilters } from './check';

export class Filters<
    T extends Condition = Condition,
> implements IFilters<T> {
    readonly value: T[];

    readonly operator: string;

    constructor(operator: string, conditions: T[]) {
        this.operator = operator;
        this.value = conditions;
    }

    accept<R>(visitor: IFiltersVisitor<R>) : R {
        return visitor.visitFilters(this);
    }

    flatten(aggregatedResult?: T[]) : IFilters<T> {
        // this.value.splice(0, this.value.length, ...next);

        return new Filters(
            this.operator,
            this.flattenInternal(this.value, this.operator, aggregatedResult),
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
            // NOT groups are not associative (not(not(x)) ≠ not(x)).
            if (
                isFilters(currentNode, operator) &&
                operator !== FilterCompoundOperator.NOT
            ) {
                currentNode.flatten(flatConditions);
            } else {
                flatConditions.push(currentNode);
            }
        }

        return flatConditions;
    }

    /**
     * Per-field replace (left/receiver priority): conditions of the other
     * side whose field the receiver also constrains are dropped. Only
     * defined when both sides are flat root-AND trees; anything else
     * throws — a compound tree is combined with and()/or(), never merged.
     */
    merge(other: IFilters) : IFilters {
        if (this.value.length === 0) {
            return other;
        }

        if (other.value.length === 0) {
            return this;
        }

        const left = extractFlatConditions(this);
        const right = extractFlatConditions(other);

        const seen = new Set<string>();
        for (const condition of left) {
            seen.add(condition.field);
        }

        const output : ICondition[] = [...left];
        for (const condition of right) {
            if (!seen.has(condition.field)) {
                output.push(condition);
            }
        }

        return new Filters(FilterCompoundOperator.AND, output);
    }

    /**
     * Wrap & inject (immutable): the receiver becomes a child of a new
     * AND group holding the given conditions. The result is never a
     * flat root-AND, so injected conditions cannot be displaced by a
     * later merge() — an empty receiver therefore wraps the injected
     * conditions in a nested group instead of adopting them directly.
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

        if (this.value.length === 0) {
            return new Filters(operator, [
                new Filters(operator, conditions),
            ]);
        }

        return new Filters(operator, [this, ...conditions]);
    }
}

function extractFlatConditions(input: IFilters) : IFilter[] {
    if (input.operator !== FilterCompoundOperator.AND) {
        throw MergeError.filtersNotFlat();
    }

    const output : IFilter[] = [];
    for (const condition of input.value) {
        if (!isFilter(condition)) {
            throw MergeError.filtersNotFlat();
        }

        output.push(condition);
    }

    return output;
}
