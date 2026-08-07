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
 * Construction options shared only by the built-in filter nodes.
 */
export type BuiltInConditionOptions = {
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

    constructor(
        operator: string,
        value: T,
    ) {
        this.operator = operator;
        this.value = value;
    }
}
