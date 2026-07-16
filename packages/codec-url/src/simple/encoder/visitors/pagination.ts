/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IPaginationVisitor, Pagination } from '@rapiq/core';
import { AdapterError } from '@rapiq/core';

import { URLParameter } from '../../../constants';
import { RecordSerializer } from '../serializer';

export class PaginationVisitor implements IPaginationVisitor<RecordSerializer> {
    protected serializer : RecordSerializer;

    constructor(serializer?: RecordSerializer) {
        this.serializer = serializer || new RecordSerializer(
            URLParameter.PAGINATION,
        );
    }

    /**
     * The wire subset mirrors the decoder: only integer limits > 0
     * and integer offsets >= 0 survive a decode — anything else
     * must fail loudly instead of silently dropping or truncating.
     */
    visitPagination(expr: Pagination): RecordSerializer {
        if (typeof expr.limit !== 'undefined') {
            if (!Number.isInteger(expr.limit) || expr.limit <= 0) {
                throw AdapterError.featureUnsupported('pagination:limit');
            }

            this.serializer.set('limit', expr.limit);
        }

        if (typeof expr.offset !== 'undefined') {
            if (!Number.isInteger(expr.offset) || expr.offset < 0) {
                throw AdapterError.featureUnsupported('pagination:offset');
            }

            // offset 0 is the wire default — absent and zero decode
            // to the same query, so emitting it is redundant.
            if (expr.offset > 0) {
                this.serializer.set('offset', expr.offset);
            }
        }

        return this.serializer;
    }
}
