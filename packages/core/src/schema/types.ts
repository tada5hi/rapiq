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
 * Per-key validation hook shared by the relations, fields and sort
 * parameters. Invoked once per resolved (alias-mapped, allow-listed)
 * client key against the schema that governs it — for dotted keys that
 * is the target schema of the relation path, not the root. The context
 * is the value passed to `parse()` / `decode()` via the `context`
 * option (`undefined` when the caller supplied none).
 *
 * Return a truthy value to accept the key. Returning `false` or
 * `undefined` rejects it — an inspect-only hook must therefore end
 * with `return true`. The result may also be a Promise of either;
 * resolving it requires the `parseAsync()` / `decodeAsync()` entry
 * points. Rejections follow the schema failure policy: dropped by
 * default, thrown (`ErrorCode.KEY_VALIDATE_REJECTED`) under
 * `throwOnFailure`. Schema defaults are server-authored and bypass
 * the hook.
 */
export type KeyValidator<CONTEXT = any> = (
    name: string,
    context: CONTEXT,
) => MaybeAsync<boolean | undefined>;

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
