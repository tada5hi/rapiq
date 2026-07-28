/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IPaginationVisitor, Pagination } from '@rapiq/core';
import type { IPaginationAdapter } from '../adapter';
import type { VisitorOptions } from './types';

export type PaginationVisitorOptions = VisitorOptions;

export class PaginationVisitor implements IPaginationVisitor<IPaginationAdapter> {
    protected adapter: IPaginationAdapter;

    protected options: PaginationVisitorOptions = {};

    constructor(
        adapter: IPaginationAdapter,
        options: PaginationVisitorOptions = {},
    ) {
        this.adapter = adapter;
        this.options = options;
    }

    visitPagination(expr: Pagination): IPaginationAdapter {
        this.adapter.setLimit(expr.limit);
        this.adapter.setOffset(expr.offset);

        return this.adapter;
    }
}
