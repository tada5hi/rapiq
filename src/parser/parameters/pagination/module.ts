/*
 * Copyright (c) 2022-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';
import { PaginationParseError } from './error';
import { BaseParser } from '../../module';
import {
    PaginationSchema, Schema, definePaginationSchema,
} from '../../../schema';
import type { RelationsParseOutput } from '../relations';
import type { PaginationParseOutput } from './types';

type PaginationParseOptions = {
    relations?: RelationsParseOutput,
    schema?: string | Schema
};

export class PaginationParser extends BaseParser<
PaginationParseOptions,
PaginationParseOutput
> {
    parse(
        input: unknown,
        options: PaginationParseOptions = {},
    ) : PaginationParseOutput {
        const schema = this.resolveSchema(options.schema);

        const output : PaginationParseOutput = {};

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
        data: PaginationParseOutput,
        options: PaginationSchema,
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

    // --------------------------------------------------

    protected resolveSchema(input?: string | Schema | PaginationSchema) : PaginationSchema {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.resolveBaseSchema(input);
            return schema.pagination;
        }

        if (input instanceof PaginationSchema) {
            return input;
        }

        return definePaginationSchema();
    }
}
