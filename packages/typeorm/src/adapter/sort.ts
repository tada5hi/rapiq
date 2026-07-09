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
    protected target : SelectQueryBuilder<any> | undefined;

    constructor(target: SelectQueryBuilder<any> | undefined, relations: RelationsAdapter) {
        super(relations);

        this.target = target;
    }

    rootAlias(): string | undefined {
        if (this.target) {
            return this.target.alias;
        }

        return undefined;
    }

    escapeField(field: string) {
        // order-by keys must stay `alias.property` — TypeORM resolves
        // them against its alias map and escapes on its own; pre-escaped
        // names break entity hydration as soon as a join is present.
        return field;
    }

    execute() {
        if (this.target) {
            this.target.orderBy(this.value);
        }
    }
}
