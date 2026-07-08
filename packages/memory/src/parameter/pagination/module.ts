/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IPagination, IPaginationVisitor } from '@rapiq/core';
import type { Slicer } from '../../types';

export class PaginationVisitor implements IPaginationVisitor<Slicer> {
    visitPagination(expr: IPagination) : Slicer {
        const { limit, offset } = expr;

        return (data) => {
            let output = data;

            if (offset && offset > 0) {
                output = output.slice(offset);
            }

            if (limit && limit > 0) {
                output = output.slice(0, limit);
            }

            return output;
        };
    }
}
