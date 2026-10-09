/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { 
    ISort, 
    ISortVisitor, 
    ISorts, 
    ISortsVisitor, 
} from '@rapiq/core';
import { SortDirection } from '@rapiq/core';
import { compareValues, resolvePath } from '../../helpers';
import type { Comparator } from '../../types';

export class SortsVisitor<T = Record<string, any>> implements ISortsVisitor<Comparator<T>>,
    ISortVisitor<Comparator<T>> {
    visitSorts(expr: ISorts) : Comparator<T> {
        const comparators = expr.value.map(
            (sort) => sort.accept<Comparator<T>>(this),
        );

        return (a, b) => {
            for (const comparator of comparators) {
                const result = comparator(a, b);
                if (result !== 0) {
                    return result;
                }
            }

            return 0;
        };
    }

    visitSort(expr: ISort) : Comparator<T> {
        const desc = expr.operator === SortDirection.DESC;

        return (a, b) => {
            const left = resolvePath(a, expr.name);
            const right = resolvePath(b, expr.name);

            // absent values sort as largest: last ascending,
            // first descending (pg semantics).
            if (left === null || right === null) {
                if (left === right) {
                    return 0;
                }

                if (left === null) {
                    return desc ? -1 : 1;
                }

                return desc ? 1 : -1;
            }

            const result = compareValues(left, right);
            if (result === undefined || result === 0) {
                return 0;
            }

            return desc ? -result : result;
        };
    }
}
