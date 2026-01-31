/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode } from './code';
import type { BaseErrorOptions } from './types';

export class BaseError extends Error {
    public readonly code : `${ErrorCode}`;

    constructor(input: BaseErrorOptions | string) {
        if (typeof input === 'string') {
            super(input);

            this.code = ErrorCode.NONE;
        } else {
            super(input.message);

            this.code = input.code || ErrorCode.NONE;
        }
    }
}
