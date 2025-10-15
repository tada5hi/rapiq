/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filters } from './filters';
import type { Condition } from './condition';

export function isCompoundCondition(
    condition: Condition,
    operator?: string,
): condition is Filters {
    if (!(condition instanceof Filters)) {
        return false;
    }

    if (operator) {
        return operator === condition.operator;
    }

    return true;
}

export function flattenConditions<T extends Condition>(
    conditions: T[],
    operator: string,
    aggregatedResult?: T[],
) {
    const flatConditions: T[] = aggregatedResult || [];

    for (let i = 0, { length } = conditions; i < length; i++) {
        const currentNode = conditions[i];

        if (isCompoundCondition(currentNode, operator)) {
            flattenConditions(currentNode.value as T[], operator, flatConditions);
        } else {
            flatConditions.push(currentNode);
        }
    }

    return flatConditions;
}

export function optimizedCompoundCondition<T extends Condition>(
    operator: string,
    conditions: T[],
): Filters<T> {
    if (conditions.length === 1) {
        const [first] = conditions;
        if (isCompoundCondition(first)) {
            return first.flatten() as Filters<T>;
        }
    }

    const filters = new Filters(operator, conditions);
    return filters.flatten();
}
