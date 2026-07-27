/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    SimpleKeys,
} from '../../../types';
import type { SortDirection } from './constants';
import type { KeyValidatableSchemaOptions, KeyValidator, KeyValidatorMany } from '../../types';

export type SortOptionDefault<T extends Record<string, any>> = {
    [K in SimpleKeys<T>]?: `${SortDirection}`
};

export type SortOptions<
    T extends Record<string, any> = Record<string, any>,
    CONTEXT = any,
> = KeyValidatableSchemaOptions<CONTEXT> & {
    allowed?: SimpleKeys<T>[] | SimpleKeys<T>[][],
    mapping?: Record<string, string>,
    default?: SortOptionDefault<T>,
    /**
     * Dynamic per-sort-key gate, e.g. an actor permission check.
     * Runs once per client-requested sort key against the schema that
     * governs it (the target schema for dotted keys), after tuple-group
     * matching. Schema defaults bypass the hook.
     *
     * An ordering is not a row set, so there is nothing for an
     * `ICondition` answer to gate and it counts as a rejection.
     * Mutually exclusive with {@link SortOptions.validateMany}.
     */
    validate?: KeyValidator<CONTEXT>,
    /**
     * Batched form of {@link SortOptions.validate}: called once per
     * relation position with every sort key this schema governs there.
     * A key missing from the returned record is rejected.
     * Mutually exclusive with `validate`.
     */
    validateMany?: KeyValidatorMany<CONTEXT>,
};

/**
 * JSON-serializable snapshot of the sort constraints a schema
 * declares. `allowed` may hold tuple groups (keys only usable
 * together, in order). The shape is uniform across schemas: a `null`
 * constraint was never declared (fallback semantics apply); an empty
 * array is an explicit "nothing".
 */
export type SortSchemaDescription = {
    allowed: string[] | string[][] | null,
    default: Record<string, `${SortDirection}`> | null,
};
