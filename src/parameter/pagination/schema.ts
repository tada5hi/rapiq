/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PaginationOptions } from './types';
import { BaseSchema } from '../../schema/base';

export class PaginationSchema extends BaseSchema<PaginationOptions> {
    get maxLimit() {
        return this.options.maxLimit;
    }
}
