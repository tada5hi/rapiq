/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ParseError } from '../../../errors';

export class PaginationParseError extends ParseError {
    static limitExceeded(limit: number) {
        return new this({
            message: `The pagination limit must not exceed the value of ${limit}.`,
        });
    }
}
