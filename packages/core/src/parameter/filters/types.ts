import type { CONDITION_MARKER } from './condition';

export interface ICondition<
    T = unknown,
> {
    readonly [CONDITION_MARKER]: true;

    /**
     * Relation-pruning protection marker. A preserved group stays atomic
     * during normalization and pruning applies its contract to the subtree.
     */
    readonly preserved?: boolean;

    readonly operator: string;

    readonly value: T;
}

/**
 * Construction options shared only by the built-in filter nodes.
 */
export type ConditionOptions = {
    preserved?: boolean,
};
