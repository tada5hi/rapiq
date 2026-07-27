/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SimpleResourceKeys } from '../../../types';
import type { KeyValidatableSchemaOptions, KeyValidator, KeyValidatorMany } from '../../types';

export type RelationsOptions<
    T extends Record<string, any> = Record<string, any>,
    CONTEXT = any,
> = KeyValidatableSchemaOptions<CONTEXT> & {
    allowed?: SimpleResourceKeys<T>[],
    includeParents?: boolean | string[] | string,
    // maps input name to local name
    mapping?: Record<string, string>,
    // set alternate value for relation key.
    pathMapping?: Record<string, string>,
    /**
     * Dynamic per-relation gate, e.g. an actor permission check.
     * Runs on the canonical relation name relative to this schema —
     * `include=client.realm` invokes the root schema's hook with
     * `client` and the client schema's hook with `realm`. Rejecting
     * a relation also drops every deeper relation reached through it.
     *
     * A relation is not a column, so there is nothing for an
     * `ICondition` answer to gate and it counts as a rejection.
     * Row-level narrowing of an included relation is tracked in #810.
     * Mutually exclusive with {@link RelationsOptions.validateMany}.
     */
    validate?: KeyValidator<CONTEXT>,
    /**
     * Batched form of {@link RelationsOptions.validate}: called once per
     * relation position with every relation this schema governs there.
     * A relation missing from the returned record is rejected.
     * Mutually exclusive with `validate`.
     */
    validateMany?: KeyValidatorMany<CONTEXT>,
};

/**
 * JSON-serializable snapshot of the relation constraints a schema
 * declares. `schemas` maps each allowed relation to the name of the
 * schema governing it (composed by {@link Schema.describe} via the
 * parent `schemaMapping`; an unmapped relation maps to itself,
 * mirroring registry resolution) — nested capabilities are looked up
 * on that schema's own description instead of being expanded inline.
 * An absent `allowed` was never declared (fallback semantics apply);
 * an empty array is an explicit "nothing".
 */
export type RelationsSchemaDescription = {
    allowed?: string[],
    schemas?: Record<string, string>,
};
