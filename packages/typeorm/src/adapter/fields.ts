/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldsBaseAdapter, pg } from '@rapiq/sql';
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
        if (this.query) {
            return this.query.escape(field);
        }
        return pg.escapeField(field);
    }

    execute() {
        if (
            this.query &&
            this.value.length > 0
        ) {
            this.query.select(this.value);
        }
    }
}
