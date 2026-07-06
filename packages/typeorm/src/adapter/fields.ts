/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldsBaseAdapter } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';
import type { RelationsAdapter } from './relations';

export class FieldsAdapter<
    QUERY extends SelectQueryBuilder<any> = SelectQueryBuilder<any>,
> extends FieldsBaseAdapter<QUERY> {
    constructor(relations: RelationsAdapter<QUERY>) {
        super(relations);
    }

    rootAlias(): string | undefined {
        if (this.query) {
            return this.query.alias;
        }

        return undefined;
    }

    escapeField(field: string) {
        // selection keys must stay `alias.property` — TypeORM resolves
        // them against its alias map and escapes on its own; pre-escaped
        // names break column resolution and entity hydration.
        return field;
    }

    execute() {
        if (!this.query) {
            return;
        }

        const columns = this.getColumns();
        if (columns.length > 0) {
            this.query.select(columns);
        }
    }
}
