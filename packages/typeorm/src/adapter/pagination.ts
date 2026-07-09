/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { PaginationBaseAdapter } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';

export class PaginationAdapter extends PaginationBaseAdapter {
    protected queryBuilder : SelectQueryBuilder<any> | undefined;

    constructor(queryBuilder?: SelectQueryBuilder<any>) {
        super();

        this.queryBuilder = queryBuilder;
    }

    override execute() {
        if (!this.queryBuilder) {
            return;
        }

        if (this.limit) {
            this.queryBuilder.take(this.limit);
        }

        if (this.offset) {
            this.queryBuilder.skip(this.offset);
        }
    }
}
