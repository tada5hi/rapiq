/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../../utils';

export const CONDITION_MARKER: unique symbol = Symbol.for('@rapiq/core/condition') as never;

export interface ICondition<
    T = unknown,
> {
    readonly [CONDITION_MARKER]: true;

    readonly operator: string;

    readonly value: T;

    /**
     * Displaceability marker: a sealed condition is never dropped by
     * {@link IFilters.merge} and never collapsed into its parent group by
     * {@link IFilters.flatten}. Set it through the `seal` helper or by
     * injecting the condition with {@link IFilters.and} / {@link IFilters.or}.
     */
    readonly sealed?: boolean;

    seal(): ICondition<T>;
}

/**
 * Identify a live condition by its non-serializable marker. Visitor dispatch
 * is deliberately not part of this check.
 */
export function isCondition(input: unknown) : input is ICondition {
    return (
        isObject(input) &&
        (input as { readonly [CONDITION_MARKER]?: unknown })[CONDITION_MARKER] === true &&
        typeof input.operator === 'string' &&
        'value' in input
    );
}

/**
 * Construction options shared by built-in condition node implementations.
 */
export type ConditionOptions = {
    sealed?: boolean,
};

/**
 * Construction options shared only by the built-in filter nodes.
 */
export type BuiltInConditionOptions = ConditionOptions & {
    preserved?: boolean,
};

/**
 * Optional implementation base for conditions; structural implementations
 * can implement {@link ICondition} without extending this class.
 */
export abstract class Condition<
    T = unknown,
> implements ICondition<T> {
    get [CONDITION_MARKER]() : true {
        return true;
    }

    readonly operator: string;

    readonly value: T;

    readonly sealed?: boolean;

    constructor(
        operator: string,
        value: T,
        options: ConditionOptions = {},
    ) {
        this.operator = operator;
        this.value = value;

        if (options.sealed) {
            this.sealed = true;
        }
    }

    abstract seal(): ICondition<T>;
}
