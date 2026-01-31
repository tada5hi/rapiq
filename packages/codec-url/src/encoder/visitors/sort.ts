/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ISortVisitor, ISortsVisitor,
    Sort,
    Sorts,
} from '@rapiq/core';
import { SortDirection } from '@rapiq/core';

import { URLParameter } from '../../constants';
import { ArraySerializer } from '../serializer';

export class SortsVisitor implements ISortsVisitor<ArraySerializer>,
ISortVisitor<ArraySerializer> {
    protected serializer : ArraySerializer;

    constructor(serializer?: ArraySerializer) {
        this.serializer = serializer || new ArraySerializer(
            URLParameter.SORT,
        );
    }

    visitSorts(expr: Sorts): ArraySerializer {
        for (let i = 0; i < expr.value.length; i++) {
            expr.value[i].accept(this);
        }

        return this.serializer;
    }

    visitSort(expr: Sort): ArraySerializer {
        if (expr.operator === SortDirection.DESC) {
            this.serializer.add(`-${expr.name}`);
        } else {
            this.serializer.add(expr.name);
        }

        return this.serializer;
    }
}
