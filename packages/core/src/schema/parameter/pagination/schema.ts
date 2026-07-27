/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PaginationOptions, PaginationSchemaDescription } from './types';
import { BaseSchema } from '../../base';

export class PaginationSchema extends BaseSchema<PaginationOptions> {
    get maxLimit() {
        return this.options.maxLimit;
    }

    // ---------------------------------------------------------

    /**
     * Serialize the declared constraints.
     */
    describe() : PaginationSchemaDescription {
        const output : PaginationSchemaDescription = {};

        if (typeof this.options.maxLimit !== 'undefined') {
            output.maxLimit = this.options.maxLimit;
        }

        return output;
    }
}
