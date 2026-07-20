/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, SchemaError } from '@rapiq/core';
import type { SchemaEntityMismatchErrorOptions } from './types';

/**
 * A schema references keys unknown to the entity it targets —
 * thrown by `assertSchemaMatchesEntity` with **every** offending
 * key collected, not just the first one.
 */
export class SchemaEntityMismatchError extends SchemaError {
    public readonly schema : string | undefined;

    public readonly entity : string;

    public readonly keys : string[];

    constructor(options: SchemaEntityMismatchErrorOptions) {
        super({
            message: `The ${options.schema ? `schema "${options.schema}"` : 'schema'} ` +
                `references keys unknown to the entity ${options.entity}: ${options.keys.join(', ')}.`,
            code: ErrorCode.SCHEMA_ENTITY_MISMATCH,
        });

        this.schema = options.schema;
        this.entity = options.entity;
        this.keys = options.keys;
    }
}
