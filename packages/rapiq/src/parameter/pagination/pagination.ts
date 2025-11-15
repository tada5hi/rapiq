/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IPaginationVisitor } from './types';

export class Pagination {
    limit : number | undefined;

    offset : number | undefined;

    constructor(limit?: number, offset?: number) {
        this.limit = limit;
        this.offset = offset;
    }

    accept<R>(visitor: IPaginationVisitor<R>) : R {
        return visitor.visitPagination(this);
    }
}
