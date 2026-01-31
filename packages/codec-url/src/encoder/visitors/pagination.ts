/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IPaginationVisitor, Pagination } from '@rapiq/core';

import { URLParameter } from '../../constants';
import { RecordSerializer } from '../serializer';

export class PaginationVisitor implements IPaginationVisitor<RecordSerializer> {
    protected serializer : RecordSerializer;

    constructor(serializer?: RecordSerializer) {
        this.serializer = serializer || new RecordSerializer(
            URLParameter.PAGINATION,
        );
    }

    visitPagination(expr: Pagination): RecordSerializer {
        if (typeof expr.limit !== 'undefined') {
            this.serializer.set('limit', expr.limit);
        }

        if (typeof expr.offset !== 'undefined') {
            this.serializer.set('offset', expr.offset);
        }

        return this.serializer;
    }
}
