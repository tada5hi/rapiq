/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery, Schema, SchemaRegistry } from '@rapiq/core';

/**
 * Which root columns compare case-sensitively: the value handed to the
 * adapter's `execute(query, { caseSensitive })`, with the same semantics.
 * `true` means every field, a list names the fields, and anything else
 * means none.
 */
export type QueryCaseSensitive = string[] | boolean;

export type QueryTagsInput<T = unknown> = {
    query: IQuery,
    /**
     * The root schema, or its name in the registry.
     */
    schema: Schema | string,
    registry: SchemaRegistry,
    /**
     * The value the read returned.
     */
    value: T,
    /**
     * The row(s) of `value`: a row, rows, null or an empty array. Default:
     * the value itself. A tuple (`findAndCount`) or an envelope carries no
     * record tag unless it is unwrapped here, e.g. `([rows]) => rows` or
     * `(value) => value.data`.
     */
    rows?: (value: T) => unknown,
    /**
     * The primary key property of every row. Default: `id`.
     */
    primaryKey?: string,
    /**
     * Exactly the `caseSensitive` option the query is executed with. A
     * string value scopes only on a column compared case-sensitively.
     * Default: none, so a string never scopes.
     */
    caseSensitive?: QueryCaseSensitive,
};

export type RememberQueryInput<T = unknown> = {
    /**
     * The cache key. It MUST encode every input that selects the result:
     * the schema name, the executed query (fields included) and every
     * input outside the query, such as the `:id` path parameter of a by-id
     * route. A codec-encoded query alone is not enough there.
     */
    key: string,
    query: IQuery,
    schema: Schema | string,
    registry: SchemaRegistry,
    /**
     * The row(s) of the value the read returned. Default: the value
     * itself. See {@link QueryTagsInput.rows}.
     */
    rows?: (value: T) => unknown,
    /**
     * The primary key property of every row. Default: `id`.
     */
    primaryKey?: string,
    /**
     * Exactly the `caseSensitive` option the query is executed with. See
     * {@link QueryTagsInput.caseSensitive}.
     */
    caseSensitive?: QueryCaseSensitive,
};
