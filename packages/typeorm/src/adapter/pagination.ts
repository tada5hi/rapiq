/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { PaginationBaseAdapter, pg } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';

export class PaginationAdapter<
    QUERY extends SelectQueryBuilder<any> = SelectQueryBuilder<any>,
> extends PaginationBaseAdapter<QUERY> {
    rootAlias(): string | undefined {
        if (this.query) {
            return this.query.alias;
        }

        return undefined;
    }

    escapeField(field: string) {
        if (this.query) {
            return this.query.escape(field);
        }
        return pg.escapeField(field);
    }

    override execute() {
        if (!this.query) {
            return;
        }

        if (this.limit) {
            this.query.take(this.limit);
        }

        if (this.offset) {
            this.query.skip(this.offset);
        }
    }
}
