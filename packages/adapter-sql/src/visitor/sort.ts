/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ISortVisitor,
    ISortsVisitor,
    Sort,
    Sorts,
} from '@rapiq/core';
import type { ISortsAdapter } from '../adapter';
import type { VisitorOptions } from './types';

export type SortsInterpreterOptions = VisitorOptions;

/**
 * @deprecated use {@link SortsInterpreterOptions}. Removed in 3.0.
 */
export type SortInterpreterOptions = SortsInterpreterOptions;

export class SortsVisitor implements ISortsVisitor<ISortsAdapter>,
ISortVisitor<ISortsAdapter> {
    protected adapter: ISortsAdapter;

    protected options: SortsInterpreterOptions;

    constructor(
        adapter: ISortsAdapter,
        options: SortsInterpreterOptions = {},
    ) {
        this.adapter = adapter;
        this.options = options;
    }

    visitSort(expr: Sort): ISortsAdapter {
        this.adapter.add(expr.name, expr.operator);

        return this.adapter;
    }

    visitSorts(expr: Sorts): ISortsAdapter {
        for (const item of expr.value) {
            item.accept(this);
        }

        return this.adapter;
    }
}
