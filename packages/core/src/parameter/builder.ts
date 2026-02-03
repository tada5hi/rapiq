/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IFields } from './fields';
import type { IFilters } from './filters';
import type { IRelations } from './relations';
import type { IPagination } from './pagination';
import type { ISorts } from './sorts';
import { Query } from './module';

export class QueryBuilder {
    fields : IFields | undefined;

    filters : IFilters | undefined;

    relations : IRelations | undefined;

    pagination : IPagination | undefined;

    sorts : ISorts | undefined;

    build() {
        return new Query({
            fields: this.fields,
            filters: this.filters,
            relations: this.relations,
            pagination: this.pagination,
            sorts: this.sorts,
        });
    }
}
