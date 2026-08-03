/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export interface ICondition<
    T = unknown,
> {
    readonly operator: string;

    readonly value: T;

    /**
     * Displaceability marker: a sealed condition is never dropped by
     * {@link IFilters.merge} and never collapsed into its parent group by
     * {@link IFilters.flatten}. Set it through the `seal` helper or by
     * injecting the condition with {@link IFilters.and} / {@link IFilters.or}.
     */
    readonly sealed?: boolean;
}

/**
 * Construction options shared by both condition node kinds.
 */
export type ConditionOptions = {
    sealed?: boolean,
};

export class Condition<
    T = unknown,
> {
    readonly operator: string;

    readonly value: T;

    constructor(operator: string, value: T) {
        this.operator = operator;

        this.value = value;
    }
}
