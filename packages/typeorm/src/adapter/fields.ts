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

    protected relationsAdapter : RelationsAdapter;

    constructor(queryBuilder: SelectQueryBuilder<any>, relations: RelationsAdapter) {
        super(relations);

        this.queryBuilder = queryBuilder;
        this.relationsAdapter = relations;
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
        // A relation join-and-selected as a whole subtree (an `include` in the
        // default 'full' hydration mode) is hydrated by the join itself, so its
        // columns must not also appear in the explicit select — that duplicates
        // the output alias (MySQL rejects it, #831). A relation joined only for a
        // filter/sort, or hydrated id-only ('key' mode), is NOT auto-selected, so
        // a field that references it stays and is projected sparsely.
        const selected = this.relationsAdapter.fullySelectedRelationAliases();

        const columns = this.getColumns().filter((column) => {
            // The join alias is always the FIRST dotted segment: relation aliases
            // never contain '.', and a column behind a relation may carry a dotted
            // embedded path (e.g. `r4_role.profile.firstName`). Splitting on the
            // last dot would miss those and re-project the embedded column (#831).
            const index = column.indexOf('.');
            if (index === -1) {
                return true;
            }

            return !selected.has(column.substring(0, index));
        });

        if (columns.length > 0) {
            this.queryBuilder.select(columns);
        }
    }
}
