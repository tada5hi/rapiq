/*
 * Copyright (c) 2023-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, ParseError } from '../../../errors';

export class PaginationParseError extends ParseError {
    static limitExceeded(limit: number) {
        return new this({
            code: ErrorCode.LIMIT_EXCEEDED,
            message: `The pagination limit must not exceed the value of ${limit}.`,
        });
    }
}
