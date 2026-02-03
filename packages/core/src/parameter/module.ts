/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IField, IFields,
} from './fields';
import type {
    IFilter, IFilters,
} from './filters';
import type { IPagination } from './pagination';
import type {
    IRelation, IRelations,
} from './relations';
import type {
    ISort, ISorts,
} from './sorts';
import type { IQuery, IQueryVisitor, QueryContext } from './types';

export class Query implements IQuery {
    public fields : IFields | IField | undefined;

    public filters : IFilters | IFilter | undefined;

    public relations : IRelations | IRelation | undefined;

    public pagination : IPagination | undefined;

    public sorts : ISorts | ISort | undefined;

    constructor(options: QueryContext = {}) {
        this.fields = options.fields;
        this.filters = options.filters;
        this.relations = options.relations;
        this.pagination = options.pagination;
        this.sorts = options.sorts;
    }

    accept<R>(visitor: IQueryVisitor<R>) : R {
        return visitor.visitQuery(this);
    }
}
