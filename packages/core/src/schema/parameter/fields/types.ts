/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { KeyValidatableSchemaOptions, KeyValidator, KeyValidatorMany } from '../../types';
import type { FieldKeys } from '../../../types';

export type FieldsOptions<
    T extends Record<string, any> = Record<string, any>,
    CONTEXT = any,
> = KeyValidatableSchemaOptions<CONTEXT> & {
    mapping?: Record<string, string>,
    allowed?: FieldKeys<T>[],
    default?: FieldKeys<T>[],
    /**
     * Dynamic per-field gate, e.g. an actor permission check.
     * Runs once per client-requested field against the schema that
     * governs it (the target schema for dotted keys). Schema defaults
     * bypass the hook.
     *
     * Answering with an `ICondition` keeps the field and marks it
     * visible only on rows satisfying that condition. The condition is
     * carried on the resulting `Field` node and never narrows the row
     * set. Mutually exclusive with {@link FieldsOptions.validateMany}.
     */
    validate?: KeyValidator<CONTEXT>,
    /**
     * Batched form of {@link FieldsOptions.validate}: called once per
     * relation position with every client-requested field this schema
     * governs there, so an authorization policy can be compiled once
     * instead of once per field. A field missing from the returned
     * record is rejected. Mutually exclusive with `validate`.
     */
    validateMany?: KeyValidatorMany<CONTEXT>,
};

/**
 * JSON-serializable snapshot of the fields constraints a schema
 * declares. The shape is uniform across schemas: a `null` constraint
 * was never declared (fallback semantics apply); an empty array is an
 * explicit "nothing".
 */
export type FieldsSchemaDescription = {
    default: string[] | null,
    allowed: string[] | null,
};
