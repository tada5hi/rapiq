/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */
import { FilterCompoundOperator } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { isFiltersBuildCompoundInput } from './helpers';
import { FiltersBuilder } from './module';
import type { FiltersBuildInput, FiltersBuilderArg } from './types';

export function filters<
    T extends ObjectLiteral = ObjectLiteral,
>(
    input?: FiltersBuildInput<T>,
) : FiltersBuilder<T> {
    if (!input) {
        return new FiltersBuilder<T>(FilterCompoundOperator.AND, []);
    }

    let clazz : FiltersBuilder<T>;
    if (isFiltersBuildCompoundInput<T>(input)) {
        clazz = new FiltersBuilder<T>(
            input.operator,
            [],
        );

        for (let i = 0; i < input.value.length; i++) {
            clazz.add(filters(input.value[i]));
        }

        return clazz;
    }

    clazz = new FiltersBuilder<T>(
        FilterCompoundOperator.AND,
        [],
    );

    clazz.addRaw(input);

    return clazz;
}

export function and<
    T extends FiltersBuilder = FiltersBuilder,
>(items: T[]) : FiltersBuilder<FiltersBuilderArg<T>> {
    return defineCompoundCondition(FilterCompoundOperator.AND, items);
}

export function or<
 T extends FiltersBuilder = FiltersBuilder,
>(items: T[]) : FiltersBuilder<FiltersBuilderArg<T>> {
    return defineCompoundCondition(FilterCompoundOperator.OR, items);
}

export function defineCompoundCondition<
    T extends FiltersBuilder = FiltersBuilder,
    A extends FiltersBuilderArg<T> = FiltersBuilderArg<T>,
>(operator: `${FilterCompoundOperator}`, items: T[]) : FiltersBuilder<A> {
    return new FiltersBuilder<A>(
        operator,
        items as FiltersBuilder<A>[],
    );
}
