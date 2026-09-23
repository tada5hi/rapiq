/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IAggregates } from './aggregates';
import type {
    IFields,
} from './fields';
import type {
    IFilters,
} from './filters';
import type { IGroups } from './groups';
import type {
    IRelations,
} from './relations';
import type { IPagination } from './pagination';
import type {
    ISorts,
} from './sorts';

export type QueryContext = {
    fields?: IFields,
    filters?: IFilters,
    relations?: IRelations,
    pagination?: IPagination,
    sorts?: ISorts,
    groups?: IGroups,
    aggregates?: IAggregates,
};

export interface IQueryVisitor<R> {
    visitQuery(expr: IQuery) : R;
}

export interface IQuery {
    readonly fields: IFields,

    readonly filters: IFilters,

    readonly relations: IRelations,

    readonly pagination: IPagination,

    readonly sorts: ISorts,

    /**
     * Grouping keys. Optional so external IQuery producers keep
     * compiling; absent reads as empty.
     */
    readonly groups?: IGroups,

    /**
     * Aggregates computed per group. Optional so external IQuery
     * producers keep compiling; absent reads as empty.
     */
    readonly aggregates?: IAggregates,

    accept<R>(visitor: IQueryVisitor<R>) : R;
}
