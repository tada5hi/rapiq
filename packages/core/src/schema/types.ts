/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    FieldsOptions,
    FieldsSchema,
    FiltersOptions,
    FiltersSchema,
    PaginationOptions,
    PaginationSchema, 
    RelationsOptions,
    RelationsSchema,
    SortOptions,
    SortSchema,
} from './parameter';
import type { Parameter } from '../constants';
import type { ICondition } from '../parameter';
import type { MaybeAsync, ObjectLiteral } from '../types';

export type BaseSchemaOptions = {
    /**
     * Name of the schema.
     */
    name?: string,

    /**
     * throw an error on invalid input for building or parsing
     * input data.
     */

    throwOnFailure?: boolean,

    /**
     * Strict mode: a parameter without an explicit allow-list
     * rejects every client key instead of falling back to the
     * syntactic property-name check.
     */
    strict?: boolean,

    /**
     * Map alias to schema name
     */
    schemaMapping?: Record<string, string>
};

/**
 * Where a client key sits in the query. Handed to every key validation
 * hook as its third argument, so a hook can branch on the position of a
 * key and not only on its name, e.g. treat a field differently at the
 * query root than when it is reached through an include.
 *
 * - `parameter` is the parameter the key belongs to, so one hook
 *   factory can serve `fields` and `sort`.
 * - `path` is the dotted relation path of the schema governing the key:
 *   `''` at the query root, `'client'` for `fields[client]=secret`,
 *   `'items.realm'` deeper.
 * - `schema` is the registered name of the governing schema
 *   (`undefined` for an inline, unregistered schema).
 */
export type KeyValidationScope = {
    readonly parameter: `${Parameter}`,
    readonly path: string,
    readonly schema?: string,
};

/**
 * The answer a key validation hook gives for one key.
 *
 * - a truthy value other than an {@link ICondition} accepts the key.
 * - `false` / `undefined` (and any other falsy value) rejects it:
 *   dropped by default, thrown (`ErrorCode.KEY_VALIDATE_REJECTED`)
 *   under `throwOnFailure`.
 * - an {@link ICondition} accepts the key, but marks it visible only on
 *   rows satisfying that condition. Supported for the `fields`
 *   parameter, where the condition is attached to the resulting `Field`
 *   node; it never changes which rows the query returns, at any level.
 *   The `sort` and `relations` parameters have no column to gate, so a
 *   condition rejects there (row-level narrowing of an included
 *   relation is tracked in #810).
 */
export type KeyValidationVerdict = boolean | ICondition | undefined;

/**
 * One verdict per key, as returned by a {@link KeyValidatorMany}. A key
 * ABSENT from the record is REJECTED, matching the `undefined`-rejects
 * rule of the per-key hook: accepted keys must be echoed explicitly.
 * Keys that were not asked about are ignored.
 */
export type KeyValidationVerdictRecord = Record<string, KeyValidationVerdict>;

/**
 * Per-key validation hook shared by the relations, fields and sort
 * parameters. Invoked once per resolved (alias-mapped, allow-listed)
 * client key against the schema that governs it — for dotted keys that
 * is the target schema of the relation path, not the root. The context
 * is the value passed to `parse()` / `decode()` via the `context`
 * option (`undefined` when the caller supplied none); the scope
 * describes where the key sits.
 *
 * Return a truthy value to accept the key. Returning `false` or
 * `undefined` rejects it — an inspect-only hook must therefore end
 * with `return true`. See {@link KeyValidationVerdict} for the
 * condition-returning form. The result may also be a Promise of any of
 * those; resolving it requires the `parseAsync()` / `decodeAsync()`
 * entry points. Rejections follow the schema failure policy: dropped by
 * default, thrown (`ErrorCode.KEY_VALIDATE_REJECTED`) under
 * `throwOnFailure`. Schema defaults are server-authored and bypass
 * the hook.
 *
 * Mutually exclusive with {@link KeyValidatorMany} on the same
 * sub-schema.
 */
export type KeyValidator<CONTEXT = any> = (
    name: string,
    context: CONTEXT,
    scope: KeyValidationScope,
) => MaybeAsync<KeyValidationVerdict>;

/**
 * Batched counterpart of {@link KeyValidator}: invoked once per
 * (governing schema, {@link KeyValidationScope.path}) with every client
 * key resolved at that position, deduplicated and in recorded order, so
 * a consumer can compile an authorization policy once instead of once
 * per key.
 *
 * `names` holds client-requested keys only, never schema defaults,
 * never excluded fields (`-email`), never keys the allow-list already
 * rejected. It is the requested key set, not the effective projection.
 *
 * Mutually exclusive with {@link KeyValidator} on the same sub-schema:
 * declaring both throws `ErrorCode.SCHEMA_KEY_VALIDATOR_CONFLICT` when
 * the schema is constructed.
 */
export type KeyValidatorMany<CONTEXT = any> = (
    names: string[],
    context: CONTEXT,
    scope: KeyValidationScope,
) => MaybeAsync<KeyValidationVerdictRecord>;

/**
 * The hook pair shared by the fields, relations and sort sub-schemas.
 * The two members are mutually exclusive.
 */
export type KeyValidatableSchemaOptions<CONTEXT = any> = BaseSchemaOptions & {
    validate?: KeyValidator<CONTEXT>,
    validateMany?: KeyValidatorMany<CONTEXT>,
};

export type SchemaOptionsNormalized<
    RECORD extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> = BaseSchemaOptions & {
    fields: FieldsOptions<RECORD, CONTEXT> | FieldsSchema<RECORD, CONTEXT>,
    filters: FiltersOptions<RECORD, CONTEXT> | FiltersSchema<RECORD, CONTEXT>,
    relations: RelationsOptions<RECORD, CONTEXT> | RelationsSchema<RECORD, CONTEXT>,
    pagination: PaginationOptions | PaginationSchema
    sort : SortOptions<RECORD, CONTEXT> | SortSchema<RECORD, CONTEXT>,
};

export type SchemaOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> = Partial<SchemaOptionsNormalized<RECORD, CONTEXT>>;
