/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';
import { BaseError } from './base';
import { ErrorCode } from './code';
import type { BaseErrorOptions } from './types';

export class SchemaError extends BaseError {
    constructor(message?: string | BaseErrorOptions) {
        if (isObject(message)) {
            message.message = message.message || 'A schema error has occurred.';
        }

        super(message || 'A schema error has occurred.');
    }

    static nameUndefined() {
        return new this({
            message: 'The schema name is not defined.',
            code: ErrorCode.SCHEMA_NAME_INVALID,
        });
    }

    static notResolvable(name: string) {
        return new this({
            message: `The schema "${name}" could not be resolved.`,
            code: ErrorCode.SCHEMA_UNRESOLVABLE,
        });
    }

    static validatorAsyncRequiresAsyncParser() {
        return new this({
            message: 'Asynchronous schema validators require parseAsync().',
            code: ErrorCode.SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER,
        });
    }
}
