/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { CompoundCondition as BaseCompoundCondition } from '@ucast/core';

import type {
    Condition,
} from './condition';

export class CompoundCondition<
    T extends Condition = Condition,
> extends BaseCompoundCondition<T> {
    add(child: T) {
        this.value.push(child);
    }

    addMany(child: T[]) {
        for (let i = 0; i < child.length; i++) {
            this.add(child[i]);
        }
    }

    clear() {
        for (let i = 0; i < this.value.length; i++) {
            delete this.value[i];
        }
    }

    // --------------------------------------------------

    hasSameOperator(condition: Condition): condition is CompoundCondition {
        return condition instanceof CompoundCondition && condition.operator === this.operator;
    }

    flattenConditions<T extends Condition>(
        conditions: T[],
        aggregatedResult?: T[],
    ) {
        const flatConditions: T[] = aggregatedResult || [];

        for (let i = 0, { length } = conditions; i < length; i++) {
            const currentNode = conditions[i];

            if (this.hasSameOperator(currentNode)) {
                this.flattenConditions(currentNode.value as T[], flatConditions);
            } else {
                flatConditions.push(currentNode);
            }
        }

        return flatConditions;
    }
}
