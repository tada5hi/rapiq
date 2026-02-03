/*
 * Copyright (c) 2022-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BasePaginationParser, Pagination, PaginationParseError, isObject,
} from '@rapiq/core';
import type {
    IPagination, ObjectLiteral, PaginationParseOptions, PaginationSchema,
} from '@rapiq/core';

export class SimplePaginationParser<
    OPTIONS extends PaginationParseOptions = PaginationParseOptions,
> extends BasePaginationParser<OPTIONS> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: PaginationParseOptions<RECORD> = {},
    ) : IPagination {
        const schema = this.resolveSchema(options.schema);

        const output = new Pagination();

        if (!isObject(input)) {
            if (schema.throwOnFailure) {
                throw PaginationParseError.inputInvalid();
            }

            return this.finalizePagination(output, schema);
        }

        let { limit, offset } = input as Record<string, any>;

        if (typeof limit !== 'undefined') {
            limit = parseInt(limit, 10);

            if (!Number.isNaN(limit) && limit > 0) {
                output.limit = limit;
            } else if (schema.throwOnFailure) {
                throw PaginationParseError.keyValueInvalid('limit');
            }
        }

        if (typeof offset !== 'undefined') {
            offset = parseInt(offset, 10);

            if (!Number.isNaN(offset) && offset >= 0) {
                output.offset = offset;
            } else if (schema.throwOnFailure) {
                throw PaginationParseError.keyValueInvalid('offset');
            }
        }

        return this.finalizePagination(output, schema);
    }

    protected finalizePagination(
        data: Pagination,
        options: PaginationSchema,
    ) : Pagination {
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
}
