/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IPagination } from '../../../parameter';
import { PaginationSchema, Schema, definePaginationSchema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../base';

export abstract class BasePaginationParser<
    OPTIONS extends ObjectLiteral = ObjectLiteral,
> extends BaseParser<OPTIONS, IPagination> {
    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | PaginationSchema) : PaginationSchema {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.getBaseSchema(input);
            return schema.pagination;
        }

        if (input instanceof PaginationSchema) {
            return input;
        }

        return definePaginationSchema();
    }
}
