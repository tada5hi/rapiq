/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator, FilterFieldOperator } from '../../schema';
import type { IFilters } from './collection';
import { Filters, isFilters } from './collection';
import type { IFilter } from './record';
import { Filter, isFilter } from './record';
import type { ICondition } from './types';

type RequiredEqualMatch = { found: false } | { found: true, value: unknown };

function matchRequiredEqual(condition: ICondition, field: string) : RequiredEqualMatch {
    if (isFilter(condition)) {
        if (condition.field === field && condition.operator === FilterFieldOperator.EQUAL) {
            return { found: true, value: condition.value };
        }

        return { found: false };
    }

    if (isFilters(condition, FilterCompoundOperator.AND)) {
        for (const child of condition.value) {
            const match = matchRequiredEqual(child, field);

            if (match.found) {
                return match;
            }
        }
    }

    return { found: false };
}

/**
 * The value `condition` requires `field` to equal: the value of the first `eq`
 * leaf on `field` reached through the root or AND groups only. An OR, a NOT or
 * a custom condition requires nothing of the field and is not entered.
 * Returns `undefined` when there is no such leaf (and for a first leaf whose
 * value is `undefined` itself; the traversal stops there either way).
 *
 * `eq` is case-insensitive by default, so for strings "every match equals the
 * value" holds up to case.
 */
export function findRequiredEqualValue(condition: ICondition, field: string) : unknown {
    const match = matchRequiredEqual(condition, field);

    return match.found ? match.value : undefined;
}

/**
 * `condition` with every `eq` leaf on `field` whose value strictly equals
 * `from` set to `to`, wherever it sits: under AND, OR and NOT groups alike.
 * `from` and `to` name the same thing (a slug and the id it resolved to), so
 * a leaf comparing against `from` inside an OR or a NOT means `to` as well;
 * left alone, it would compare the stored id against the slug and never
 * match. Leaves holding any other value are left as they are: only the value
 * the caller resolved is rewritten. Other operators (`ne`, `in`, ...) are not
 * rewritten.
 *
 * Nodes that did not change are carried over by reference, and the input
 * itself is returned when nothing below it changed. A rewritten leaf or
 * rebuilt group keeps its operator and its `preserved` flag. A custom
 * condition is opaque and returned as it is.
 *
 * The result keeps the node kind (a group for a group, a leaf for a leaf) but
 * not the input's value types: `to` may be of another type than `from`.
 */
export function replaceRequiredEqualValue(condition: IFilters, field: string, from: unknown, to: unknown) : IFilters;
export function replaceRequiredEqualValue(
    condition: IFilter<string, unknown>,
    field: string,
    from: unknown,
    to: unknown,
) : IFilter<string, unknown>;
export function replaceRequiredEqualValue(condition: ICondition, field: string, from: unknown, to: unknown) : ICondition;
export function replaceRequiredEqualValue(
    condition: ICondition,
    field: string,
    from: unknown,
    to: unknown,
) : ICondition {
    if (isFilter(condition)) {
        if (
            condition.field === field &&
            condition.operator === FilterFieldOperator.EQUAL &&
            condition.value === from
        ) {
            return new Filter(condition.operator, field, to, { preserved: condition.preserved });
        }

        return condition;
    }

    if (isFilters(condition)) {
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
        );
    }

    return condition;
}
