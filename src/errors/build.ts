/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';
import { BaseError } from './base';
import type { BaseErrorOptions } from './types';

export class BuildError extends BaseError {
    constructor(message?: string | BaseErrorOptions) {
        if (isObject(message)) {
            message.message = 'A building error has occurred.';
        }

        super(message || 'A building error has occurred.');
    }
}
