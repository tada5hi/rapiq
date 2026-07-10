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
        // apply unconditionally so a re-run whose query drops pagination
        // resets the builder (falsy limit/offset -> undefined = no clause),
        // instead of leaking the previous run's take/skip.
        this.queryBuilder.take(this.limit || undefined);
        this.queryBuilder.skip(this.offset || undefined);
    }
}
