/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { PaginationBaseAdapter } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';

export class PaginationAdapter extends PaginationBaseAdapter {
    protected target : SelectQueryBuilder<any> | undefined;

    constructor(target?: SelectQueryBuilder<any>) {
        super();

        this.target = target;
    }

    override execute() {
        if (!this.target) {
            return;
        }

        if (this.limit) {
            this.target.take(this.limit);
        }

        if (this.offset) {
            this.target.skip(this.offset);
        }
    }
}
