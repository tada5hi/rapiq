/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator, FilterFieldOperator } from '../../schema';
import { Filters, isFilters } from './collection';
import { Filter, isFilter } from './record';
import type { ICondition } from './types';

/**
 * The value `condition` requires `field` to equal: the value of the first `eq`
 * leaf on `field` reached through the root or AND groups only. An OR, a NOT or
 * a custom condition requires nothing of the field and is not entered.
 * Returns `undefined` when there is no such leaf.
 *
 * `eq` is case-insensitive by default, so for strings "every match equals the
 * value" holds up to case.
 */
export function findRequiredEqualValue(condition: ICondition, field: string) : unknown | undefined {
    if (isFilter(condition)) {
        if (condition.field === field && condition.operator === FilterFieldOperator.EQUAL) {
            return condition.value;
        }

        return undefined;
    }

    if (isFilters(condition, FilterCompoundOperator.AND)) {
        for (const child of condition.value) {
            const value = findRequiredEqualValue(child, field);

            if (value !== undefined) {
                return value;
            }
        }
    }

    return undefined;
}

/**
 * `condition` with every `eq` leaf on `field` (reached through the root or AND
 * groups only) whose value strictly equals `from` set to `to`. Guarding by
 * `from` keeps `eq a AND eq b` from widening into a match: only the leaf the
 * caller resolved is rewritten.
 *
 * Nodes that did not change are carried over by reference, and the input
 * itself is returned when nothing below it changed. A rewritten leaf or
 * rebuilt AND group keeps its `preserved` flag. OR, NOT and custom conditions
 * are opaque and returned as they are.
 */
export function replaceRequiredEqualValue<T extends ICondition>(
    condition: T,
    field: string,
    from: unknown,
    to: unknown,
) : T {
    if (isFilter(condition)) {
        if (
            condition.field === field &&
            condition.operator === FilterFieldOperator.EQUAL &&
            condition.value === from
        ) {
            return new Filter(condition.operator, field, to, { preserved: condition.preserved }) as ICondition as T;
        }

        return condition;
    }

    if (isFilters(condition, FilterCompoundOperator.AND)) {
        let changed = false;
        const children = condition.value.map((child) => {
            const next = replaceRequiredEqualValue(child, field, from, to);

            if (next !== child) {
                changed = true;
            }

            return next;
        });

        if (!changed) {
            return condition;
        }

        return new Filters(
            condition.operator,
            children,
            { preserved: condition.preserved },
        ) as ICondition as T;
    }

    return condition;
}
