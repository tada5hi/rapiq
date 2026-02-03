/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type {
    IField, IFields,
} from './fields';
import type {
    IFilter,
    IFilters,
} from './filters';
import type {
    IRelation,
    IRelations,
} from './relations';
import type { IPagination } from './pagination';
import type {
    ISort,
    ISorts,
} from './sorts';

export type QueryContext = {
    fields?: IFields | IField,
    filters?: IFilters | IFilter,
    relations?: IRelations | IRelation,
    pagination?: IPagination,
    sorts?: ISorts | ISort
};

export interface IQueryVisitor<R> {
    visitQuery(expr: IQuery) : R;
}

export interface IQuery {
    fields?: IFields | IField,

    filters?: IFilters | IFilter,

    relations?: IRelations | IRelation,

    pagination?: IPagination,

    sorts?: ISorts | ISort

    accept<R>(visitor: IQueryVisitor<R>) : R;
}
