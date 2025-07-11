/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition, FieldCondition } from '../../../../schema';
import {
    FilterCompoundOperator,
} from '../../../../schema';
import type { ObjectLiteral } from '../../../../types';
import type { FiltersBuildInput } from '../types';
import { FiltersCompoundConditionBuilder } from './compound';
import { FiltersConditionBuilder } from './fields';

export function filters<
    T extends ObjectLiteral = ObjectLiteral,
>(
    input: FiltersBuildInput<T> | FieldCondition<T>[] = [],
) : FiltersConditionBuilder<T> {
    const clazz = new FiltersConditionBuilder<T>();
    if (Array.isArray(input)) {
        clazz.addMany(input);
    } else {
        clazz.addRaw(input);
    }

    return clazz;
}

export function and<
    T extends Condition = Condition,
>(items: T[]) : FiltersCompoundConditionBuilder<T> {
    return defineCompoundCondition(FilterCompoundOperator.AND, items);
}

export function or<
 T extends Condition = Condition,
>(items: T[]) : FiltersCompoundConditionBuilder<T> {
    return defineCompoundCondition(FilterCompoundOperator.OR, items);
}

export function defineCompoundCondition<
    T extends Condition = Condition,
>(operator: `${FilterCompoundOperator}`, items: T[]) : FiltersCompoundConditionBuilder<T> {
    return new FiltersCompoundConditionBuilder<T>(operator, items);
}
