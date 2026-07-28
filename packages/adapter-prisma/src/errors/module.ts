/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, SchemaError } from '@rapiq/core';
import type { SchemaModelMismatchErrorOptions } from './types';

/**
 * A schema references keys unknown to the model it targets: thrown
 * by `assertSchemaMatchesModel` with **every** offending key
 * collected, not just the first one.
 */
export class SchemaModelMismatchError extends SchemaError {
    public readonly schema : string | undefined;

    public readonly model : string;

    public readonly keys : string[];

    constructor(options: SchemaModelMismatchErrorOptions) {
        super({
            message: `The ${options.schema ? `schema "${options.schema}"` : 'schema'} ` +
                `references keys unknown to the model ${options.model}: ${options.keys.join(', ')}.`,
            code: ErrorCode.SCHEMA_ENTITY_MISMATCH,
        });

        this.schema = options.schema;
        this.model = options.model;
        this.keys = options.keys;
    }
}
