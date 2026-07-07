/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';
import { BaseError } from './base';
import { ErrorCode } from './code';
import type { BaseErrorOptions } from './types';

export class BuildError extends BaseError {
    constructor(message?: string | BaseErrorOptions) {
        if (isObject(message)) {
            message.message = message.message || 'A building error has occurred.';
        }

        super(message || 'A building error has occurred.');
    }

    static inputInvalid() {
        return new this({
            message: 'The shape of the input is not valid.',
            code: ErrorCode.INPUT_INVALID,
        });
    }

    static keyInvalid(key: string) {
        return new this({
            message: `The key ${key} is invalid.`,
            code: ErrorCode.KEY_INVALID,
        });
    }

    static keyValueInvalid(key: string) {
        return new this({
            message: `The value of the key ${key} is invalid.`,
            code: ErrorCode.KEY_VALUE_INVALID,
        });
    }

    static operatorUnsupported(operator: string) {
        return new this({
            message: `The operator ${operator} is not supported.`,
            code: ErrorCode.OPERATOR_UNSUPPORTED,
        });
    }
}
