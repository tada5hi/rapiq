/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldsBaseAdapter } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';
import type { RelationsAdapter } from './relations';

export class FieldsAdapter extends FieldsBaseAdapter {
    protected queryBuilder : SelectQueryBuilder<any>;

    constructor(queryBuilder: SelectQueryBuilder<any>, relations: RelationsAdapter) {
        super(relations);

        this.queryBuilder = queryBuilder;
    }

    rootAlias(): string | undefined {
        return this.queryBuilder.alias;
    }

    escapeField(field: string) {
        // selection keys must stay `alias.property` — TypeORM resolves
        // them against its alias map and escapes on its own; pre-escaped
        // names break column resolution and entity hydration.
        return field;
    }

    override execute() {
        const columns = this.getColumns();
        if (columns.length > 0) {
            this.queryBuilder.select(columns);
        }
    }
}
