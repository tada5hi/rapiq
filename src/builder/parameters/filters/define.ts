/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */
import { FilterCompoundOperator } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import type { FiltersBuildInput } from './types';
import { FiltersBuilder } from './module';

export function filters<
    T extends ObjectLiteral = ObjectLiteral,
>(
    input?: FiltersBuildInput<T>,
) : FiltersBuilder<T> {
    const clazz = new FiltersBuilder<T>(
        FilterCompoundOperator.AND,
        [],
    );

    if (input) {
        clazz.addRaw(input);
    }

    return clazz;
}

type BuilderArg<T> = T extends FiltersBuilder<infer U> ? U : never;

export function and<
    T extends FiltersBuilder = FiltersBuilder,
>(items: T[]) : FiltersBuilder<BuilderArg<T>> {
    return defineCompoundCondition(FilterCompoundOperator.AND, items);
}

export function or<
 T extends FiltersBuilder = FiltersBuilder,
>(items: T[]) : FiltersBuilder<BuilderArg<T>> {
    return defineCompoundCondition(FilterCompoundOperator.OR, items);
}

export function defineCompoundCondition<
    T extends FiltersBuilder = FiltersBuilder,
>(operator: `${FilterCompoundOperator}`, items: T[]) : FiltersBuilder<BuilderArg<T>> {
    return new FiltersBuilder<BuilderArg<T>>(
        operator,
        items,
    );
}
