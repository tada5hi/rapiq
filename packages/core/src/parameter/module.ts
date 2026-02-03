/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IFields } from './fields';
import {
    Fields,
} from './fields';
import type { IFilters } from './filters';
import {
    Filters,
} from './filters';
import type { IPagination } from './pagination';
import { Pagination } from './pagination';
import type { IRelations } from './relations';
import { Relations } from './relations';
import type { ISorts } from './sorts';
import {
    Sorts,
} from './sorts';
import type { IQuery, IQueryVisitor, QueryContext } from './types';
import { FilterCompoundOperator } from '../schema';

export class Query implements IQuery {
    readonly fields : IFields;

    readonly filters : IFilters;

    readonly relations : IRelations;

    readonly pagination : IPagination;

    readonly sorts : ISorts;

    constructor(options: QueryContext = {}) {
        this.fields = options.fields || new Fields();
        this.filters = options.filters || new Filters(FilterCompoundOperator.AND, []);
        this.relations = options.relations || new Relations();
        this.pagination = options.pagination || new Pagination();
        this.sorts = options.sorts || new Sorts();
    }

    accept<R>(visitor: IQueryVisitor<R>) : R {
        return visitor.visitQuery(this);
    }
}
