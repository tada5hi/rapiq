/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';
import { BaseError } from './base';
import { ErrorCode } from './code';
import type { BaseErrorOptions } from './types';

export class MergeError extends BaseError {
    constructor(message?: string | BaseErrorOptions) {
        if (isObject(message)) {
            message.message = message.message || 'A merging error has occurred.';
        }

        super(message || 'A merging error has occurred.');
    }

    static filtersNotFlat() {
        return new this({
            message: 'Filters can only be merged when both sides are flat root-AND condition trees. ' +
                'Combine compound trees with and()/or() instead.',
            code: ErrorCode.FILTERS_NOT_FLAT,
        });
    }
}
