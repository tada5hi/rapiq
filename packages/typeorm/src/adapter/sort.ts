/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SortBaseAdapter } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';
import type { RelationsAdapter } from './relations';

export class SortAdapter extends SortBaseAdapter {
    protected queryBuilder : SelectQueryBuilder<any>;

    constructor(queryBuilder: SelectQueryBuilder<any>, relations: RelationsAdapter) {
        super(relations);

        this.queryBuilder = queryBuilder;
    }

    rootAlias(): string | undefined {
        return this.queryBuilder.alias;
    }

    escapeField(field: string) {
        // order-by keys must stay `alias.property` — TypeORM resolves
        // them against its alias map and escapes on its own; pre-escaped
        // names break entity hydration as soon as a join is present.
        return field;
    }

    override execute() {
        // a query without sorts leaves a caller-owned ORDER BY untouched —
        // the same preservation contract the filters adapter applies to
        // WHERE. TypeORM's orderBy({}) would REPLACE the builder state.
        if (Object.keys(this.value).length > 0) {
            this.queryBuilder.orderBy(this.value);
        }
    }
}
