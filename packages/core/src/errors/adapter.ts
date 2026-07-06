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

export class AdapterError extends BaseError {
    constructor(message?: string | BaseErrorOptions) {
        if (isObject(message)) {
            message.message = message.message || 'An adapter error has occurred.';
        }

        super(message || 'An adapter error has occurred.');
    }

    static operatorUnsupported(operator: string) {
        return new this({
            message: `The filter operator ${operator} is not supported.`,
            code: ErrorCode.OPERATOR_UNSUPPORTED,
        });
    }

    static featureUnsupported(feature: string) {
        return new this({
            message: `The feature ${feature} is not supported by the dialect.`,
            code: ErrorCode.FEATURE_UNSUPPORTED,
        });
    }
}
