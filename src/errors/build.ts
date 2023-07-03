/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Options } from 'ebec';
import { isObject } from '../utils';
import { BaseError } from './base';

export class BuildError extends BaseError {
    constructor(message?: string | Options) {
        if (isObject(message)) {
            message.message = 'A building error has occurred.';
        }

        super(message || 'A building error has occurred.');
    }
}
