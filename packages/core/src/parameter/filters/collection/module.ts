/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { CompoundCondition as BaseCompoundCondition } from '@ucast/core';

import type { Condition } from '../condition';
import type { IFiltersVisitor } from './types';

export class Filters<
    T extends Condition = Condition,
> extends BaseCompoundCondition<T> {
    accept<R>(visitor: IFiltersVisitor<R>) : R {
        return visitor.visitFilters(this);
    }

    add(child: T) {
        this.value.push(child);
    }

    clear() {
        for (let i = this.value.length - 1; i === 0; i--) {
            this.value.splice(i, 1);
        }
    }

    flatten(aggregatedResult?: T[]) : Filters<T> {
        // this.value.splice(0, this.value.length, ...next);

        return new Filters(
            this.operator,
            this.flattenInternal(this.value, this.operator, aggregatedResult),
        );
    }

    protected flattenInternal<F extends Condition>(
        conditions: F[],
        operator: string,
        aggregatedResult?: F[],
    ) {
        const flatConditions: F[] = aggregatedResult || [];

        for (let i = 0, { length } = conditions; i < length; i++) {
            const currentNode = conditions[i];

            if (Filters.check(currentNode, operator)) {
                currentNode.flatten(flatConditions);
            } else {
                flatConditions.push(currentNode);
            }
        }

        return flatConditions;
    }

    static check(
        condition: Condition,
        operator?: string,
    ) : condition is Filters {
        if (!(condition instanceof Filters)) {
            return false;
        }

        if (operator) {
            return operator === condition.operator;
        }

        return true;
    }
}
