/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../../utils';

export const CONDITION_MARKER: unique symbol = Symbol.for('@rapiq/core/condition');

export interface ICondition<
    T = unknown,
> {
    readonly [CONDITION_MARKER]: boolean;

    /**
     * Relation-pruning protection marker. A preserved group stays atomic
     * during normalization and pruning applies its contract to the subtree.
     */
    readonly preserved?: boolean;

    readonly operator: string;

    readonly value: T;
}

/**
 * Identify a live condition by its non-serializable marker. Visitor dispatch
 * is deliberately not part of this check.
 */
export function isCondition(input: unknown) : input is ICondition {
    if (!isObject(input)) {
        return false;
    }

    if (!(CONDITION_MARKER in input)) {
        return false;
    }

    if (typeof input.operator !== 'string') {
        return false;
    }

    if (!('value' in input)) {
        return false;
    }

    return typeof input.preserved === 'undefined' ||
        typeof input.preserved === 'boolean';
}

/**
 * Construction options shared only by the built-in filter nodes.
 */
export type ConditionOptions = {
    preserved?: boolean,
};

/**
 * Optional implementation base for conditions; structural implementations
 * can implement {@link ICondition} without extending this class.
 */
export abstract class Condition<
    T = unknown,
> implements ICondition<T> {
    get [CONDITION_MARKER]() : boolean {
        return true;
    }

    readonly operator: string;

    readonly value: T;

    protected constructor(
        operator: string,
        value: T,
    ) {
        this.operator = operator;
        this.value = value;
    }
}
