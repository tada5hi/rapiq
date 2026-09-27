/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery, Schema, SchemaRegistry } from '@rapiq/core';

export type QueryTagsInput = {
    query: IQuery,
    /**
     * The root schema, or its name in the registry.
     */
    schema: Schema | string,
    registry: SchemaRegistry,
    /**
     * The hydrated result: a row, rows, null or an empty array.
     */
    value: unknown,
    /**
     * The primary key property of every row. Default: `id`.
     */
    key?: string,
};

export type RememberQueryInput = {
    /**
     * The cache key. A codec-encoded query plus the schema name is the
     * natural one; this package does not encode queries itself.
     */
    key: string,
    query: IQuery,
    schema: Schema | string,
    registry: SchemaRegistry,
    /**
     * The primary key property of every row. Default: `id`.
     */
    primaryKey?: string,
};
