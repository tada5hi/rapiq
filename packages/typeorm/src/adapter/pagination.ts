/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { PaginationBaseAdapter } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';

export class PaginationAdapter extends PaginationBaseAdapter {
    protected queryBuilder : SelectQueryBuilder<any>;

    constructor(queryBuilder: SelectQueryBuilder<any>) {
        super();

        this.queryBuilder = queryBuilder;
    }

    override execute() {
        // a query without pagination leaves caller-owned take/skip
        // untouched — the same preservation contract the filters adapter
        // applies to WHERE. The adapter/builder pair is per-request;
        // resetting a previous run is not this method's job.
        if (typeof this.limit !== 'undefined') {
            this.queryBuilder.take(this.limit || undefined);
        }

        if (typeof this.offset !== 'undefined') {
            this.queryBuilder.skip(this.offset || undefined);
        }
    }
}
