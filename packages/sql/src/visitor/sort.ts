/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ISortVisitor, ISortsVisitor, Sort, Sorts,
} from '@rapiq/core';
import type { ISortAdapter } from '../adapter';
import type { VisitorOptions } from './types';

export type SortInterpreterOptions = VisitorOptions;

export class SortsVisitor implements ISortsVisitor<ISortAdapter>,
ISortVisitor<ISortAdapter> {
    protected adapter: ISortAdapter;

    protected options: SortInterpreterOptions;

    constructor(
        adapter: ISortAdapter,
        options: SortInterpreterOptions = {},
    ) {
        this.adapter = adapter;
        this.options = options;
    }

    visitSort(expr: Sort): ISortAdapter {
        this.adapter.add(expr.name, expr.operator);

        return this.adapter;
    }

    visitSorts(expr: Sorts): ISortAdapter {
        for (let i = 0; i < expr.value.length; i++) {
            expr.value[i].accept(this);
        }

        return this.adapter;
    }
}
