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

export class CodecError extends BaseError {
    constructor(message?: string | BaseErrorOptions) {
        if (isObject(message)) {
            message.message = message.message || 'A codec error has occurred.';
        }

        super(message || 'A codec error has occurred.');
    }

    static notResolvable(name?: string) {
        return new this({
            message: name ?
                `The codec ${name} could not be resolved.` :
                'No codec could be resolved.',
            code: ErrorCode.CODEC_UNRESOLVABLE,
        });
    }
}
