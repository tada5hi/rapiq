/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, SchemaError } from '@rapiq/core';
import type { SchemaEntityIndexMismatchErrorOptions } from './types';

/**
 * A schema declares index sequences no index, unique constraint or
 * primary key of the entity backs. Thrown by
 * `assertSchemaMatchesEntity` with **every** offending sequence
 * collected, not just the first one.
 */
export class SchemaEntityIndexMismatchError extends SchemaError {
    public readonly schema : string | undefined;

    public readonly entity : string;

    public readonly indexes : string[][];

    constructor(options: SchemaEntityIndexMismatchErrorOptions) {
        super({
            message: `The ${options.schema ? `schema "${options.schema}"` : 'schema'} ` +
                `declares indexes not backed by the entity ${options.entity}: ` +
                `${options.indexes.map((index) => `(${index.join(', ')})`).join(', ')}.`,
            code: ErrorCode.SCHEMA_ENTITY_INDEX_MISMATCH,
        });

        this.schema = options.schema;
        this.entity = options.entity;
        this.indexes = options.indexes;
    }
}
