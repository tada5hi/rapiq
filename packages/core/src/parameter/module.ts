/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Field, Fields } from './fields';
import type { Filter, Filters } from './filters';
import type { Pagination } from './pagination';
import type { Relation, Relations } from './relations';
import type { Sort, Sorts } from './sorts';
import type { IQueryVisitor, QueryOptions } from './types';

export class Query {
    public fields : Fields | Field | undefined;

    public filters : Filters | Filter | undefined;

    public relations : Relations | Relation | undefined;

    public pagination : Pagination | undefined;

    public sorts : Sorts | Sort | undefined;

    constructor(options: QueryOptions = {}) {
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
