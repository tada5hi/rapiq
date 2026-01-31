/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type {
    Field, Fields,
} from './fields';
import type {
    Filter,
    Filters,
} from './filters';
import type { Query } from './module';
import type {
    Relation,
    Relations,
} from './relations';
import type { Pagination } from './pagination';
import type {
    Sort, Sorts,
} from './sorts';

export type QueryOptions = {
    fields?: Fields | Field,
    filters?: Filters | Filter,
    relations?: Relations | Relation,
    pagination?: Pagination,
    sorts?: Sorts | Sort
};

export interface IQueryVisitor<R> {
    visitQuery(expr: Query) : R;
}
