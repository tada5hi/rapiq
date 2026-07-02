/*
 * Copyright (c) 2022-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BaseParser,
    Pagination,
    PaginationParseError,
    Parameter,
    ResolutionScope,
    isObject,
} from '@rapiq/core';
import type {
    IPagination,
    ObjectLiteral,
    PaginationParseOptions,
    PaginationSchema,
} from '@rapiq/core';

export class SimplePaginationParser<
    OPTIONS extends PaginationParseOptions = PaginationParseOptions,
> extends BaseParser<OPTIONS, IPagination> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: PaginationParseOptions<RECORD> = {},
    ) : IPagination {
        const scope = ResolutionScope.for(this.registry, Parameter.PAGINATION, options.schema, { throwOnFailure: options.throwOnFailure });

        const { schema, throwOnFailure } = scope;

        const output = new Pagination();

        if (!isObject(input)) {
            if (throwOnFailure) {
                throw PaginationParseError.inputInvalid();
            }

            return this.finalizePagination(output, schema, throwOnFailure);
        }

        let { limit, offset } = input as Record<string, any>;

        if (typeof limit !== 'undefined') {
            limit = Number.parseInt(limit, 10);

            if (!Number.isNaN(limit) && limit > 0) {
                output.limit = limit;
            } else if (throwOnFailure) {
                throw PaginationParseError.keyValueInvalid('limit');
            }
        }

        if (typeof offset !== 'undefined') {
            offset = Number.parseInt(offset, 10);

            if (!Number.isNaN(offset) && offset >= 0) {
                output.offset = offset;
            } else if (throwOnFailure) {
                throw PaginationParseError.keyValueInvalid('offset');
            }
        }

        return this.finalizePagination(output, schema, throwOnFailure);
    }

    protected finalizePagination(
        data: Pagination,
        schema: PaginationSchema,
        throwOnFailure?: boolean,
    ) : Pagination {
        if (typeof schema.maxLimit !== 'undefined') {
            if (
                typeof data.limit === 'undefined' ||
                data.limit > schema.maxLimit
            ) {
                if (throwOnFailure) {
                    throw PaginationParseError.limitExceeded(schema.maxLimit);
                }

                data.limit = schema.maxLimit;
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
