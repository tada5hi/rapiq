/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';
import { PaginationParseError } from './errors';
import type { PaginationParseOptions, PaginationParseOutput } from './type';

// --------------------------------------------------

function finalizePagination(
    data: PaginationParseOutput,
    options: PaginationParseOptions,
) : PaginationParseOutput {
    if (typeof options.maxLimit !== 'undefined') {
        if (
            typeof data.limit === 'undefined' ||
            data.limit > options.maxLimit
        ) {
            if (options.throwOnFailure) {
                throw PaginationParseError.limitExceeded(options.maxLimit);
            }

            data.limit = options.maxLimit;
        }
    }

    if (
        typeof data.limit !== 'undefined' &&
        typeof data.offset === 'undefined'
    ) {
        data.offset = 0;
    }

    return data;
}

/**
 * Transform pagination data to an appreciate data format.
 *
 * @param data
 * @param options
 */
export function parseQueryPagination(
    data: unknown,
    options: PaginationParseOptions = {},
) : PaginationParseOutput {
    const output : PaginationParseOutput = {};

    if (!isObject(data)) {
        if (options.throwOnFailure) {
            throw PaginationParseError.inputInvalid();
        }

        return finalizePagination(output, options);
    }

    let { limit, offset } = data as Record<string, any>;

    if (typeof limit !== 'undefined') {
        limit = parseInt(limit, 10);

        if (!Number.isNaN(limit) && limit > 0) {
            output.limit = limit;
        } else if (options.throwOnFailure) {
            throw PaginationParseError.keyValueInvalid('limit');
        }
    }

    if (typeof offset !== 'undefined') {
        offset = parseInt(offset, 10);

        if (!Number.isNaN(offset) && offset >= 0) {
            output.offset = offset;
        } else if (options.throwOnFailure) {
            throw PaginationParseError.keyValueInvalid('offset');
        }
    }

    return finalizePagination(output, options);
}
