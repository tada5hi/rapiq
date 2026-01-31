/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Field,
    Fields,
    Filter,
    Filters,
    IFieldVisitor,
    IFieldsVisitor,
    IFilterVisitor,
    IFiltersVisitor,
    IPaginationVisitor,
    IQueryVisitor,
    IRelationVisitor,
    IRelationsVisitor,
    ISortVisitor,
    ISortsVisitor,
    Pagination,
    Query, Relation, Relations, Sort, Sorts,
} from '@rapiq/core';
import type {
    IFieldsAdapter,
    IFiltersAdapter,
    IPaginationAdapter,
    IRelationsAdapter,
    IRootAdapter,
    ISortAdapter,
} from '../adapter';
import { FieldsVisitor } from './fields';
import { FiltersVisitor } from './filters';
import { PaginationVisitor } from './pagination';
import { RelationsVisitor } from './relations';
import { SortsVisitor } from './sort';
import type { VisitorOptions } from './types';

export class QueryVisitor implements IQueryVisitor<IRootAdapter>,
    IFieldsVisitor<IFieldsAdapter>,
    IFieldVisitor<IFieldsAdapter>,
    IFiltersVisitor<IFiltersAdapter>,
    IFilterVisitor<IFiltersAdapter>,
    IPaginationVisitor<IPaginationAdapter>,
    IRelationsVisitor<IRelationsAdapter>,
    IRelationVisitor<IRelationsAdapter>,
    ISortsVisitor<ISortAdapter>,
    ISortVisitor<ISortAdapter> {
    protected container : IRootAdapter;

    protected options: VisitorOptions;

    public readonly fields : FieldsVisitor;

    public readonly filters : FiltersVisitor;

    public readonly pagination : PaginationVisitor;

    public readonly relations : RelationsVisitor;

    public readonly sorts : SortsVisitor;

    // -----------------------------------------------------------

    constructor(adapter: IRootAdapter, options: VisitorOptions = {}) {
        this.container = adapter;
        this.options = options;

        this.fields = new FieldsVisitor(adapter.fields);
        this.filters = new FiltersVisitor(adapter.filters);
        this.pagination = new PaginationVisitor(adapter.pagination);
        this.relations = new RelationsVisitor(adapter.relations);
        this.sorts = new SortsVisitor(adapter.sort);
    }

    // -----------------------------------------------------------

    visitQuery(input: Query): IRootAdapter {
        if (input.relations) {
            input.relations.accept(this.relations);
        }

        if (input.fields) {
            input.fields.accept(this.fields);
        }

        if (input.filters) {
            input.filters.accept(this.filters);
        }

        if (input.pagination) {
            input.pagination.accept(this.pagination);
        }

        if (input.sorts) {
            input.sorts.accept(this.sorts);
        }

        return this.container;
    }

    visitFields(expr: Fields): IFieldsAdapter {
        return expr.accept(this.fields);
    }

    visitField(expr: Field): IFieldsAdapter {
        return expr.accept(this.fields);
    }

    visitFilters(expr: Filters): IFiltersAdapter {
        return expr.accept(this.filters);
    }

    visitFilter(expr: Filter) : IFiltersAdapter {
        return expr.accept(this.filters);
    }

    visitPagination(expr: Pagination): IPaginationAdapter {
        return expr.accept(this.pagination);
    }

    visitRelations(input: Relations) : IRelationsAdapter {
        return input.accept(this.relations);
    }

    visitRelation(expr: Relation): IRelationsAdapter {
        return expr.accept(this.relations);
    }

    visitSorts(expr: Sorts): ISortAdapter {
        return expr.accept(this.sorts);
    }

    visitSort(expr: Sort): ISortAdapter {
        return expr.accept(this.sorts);
    }
}
