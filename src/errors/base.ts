/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BaseError as Base } from 'ebec';
import { ErrorCode } from './code';

export class BaseError extends Base {
    get code() : `${ErrorCode}` {
        return this.getOption('code') as `${ErrorCode}` || ErrorCode.NONE;
    }
}
