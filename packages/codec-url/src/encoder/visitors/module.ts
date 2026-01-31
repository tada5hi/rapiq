/*
 * Copyright (c) 2025.
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
    Query,
    Relation,
    Relations,
    Sort, Sorts,
} from '@rapiq/core';
import type { ArraySerializer, RecordArraySerializer, RecordSerializer } from '../serializer';
import { QuerySerializer } from '../serializer';
import { FieldsVisitor } from './fields';
import { FiltersVisitor } from './filters';
import { PaginationVisitor } from './pagination';
import { RelationsVisitor } from './relations';
import { SortsVisitor } from './sort';

export class QueryVisitor implements IQueryVisitor<QuerySerializer>,
    IFieldsVisitor<RecordArraySerializer>,
    IFieldVisitor<RecordArraySerializer>,
    IFiltersVisitor<RecordSerializer>,
    IFilterVisitor<RecordSerializer>,
    IFilterVisitor<RecordSerializer>,
    IPaginationVisitor<RecordSerializer>,
    IRelationsVisitor<ArraySerializer>,
    IRelationVisitor<ArraySerializer>,
    ISortsVisitor<ArraySerializer>,
    ISortVisitor<ArraySerializer> {
    protected serializer : QuerySerializer;

    protected fields: FieldsVisitor;

    protected filters : FiltersVisitor;

    protected pagination : PaginationVisitor;

    protected relations: RelationsVisitor;

    protected sort : SortsVisitor;

    constructor() {
        const serializer = new QuerySerializer();
        this.serializer = serializer;

        this.fields = new FieldsVisitor(serializer.fields);
        this.filters = new FiltersVisitor(serializer.filters);
        this.pagination = new PaginationVisitor(serializer.pagination);
        this.relations = new RelationsVisitor(serializer.relations);
        this.sort = new SortsVisitor(serializer.sort);
    }

    visitQuery(expr: Query): QuerySerializer {
        if (expr.fields) {
            expr.fields.accept(this.fields);
        }

        if (expr.filters) {
            expr.filters.accept(this.filters);
        }

        if (expr.pagination) {
            expr.pagination.accept(this.pagination);
        }

        if (expr.relations) {
            expr.relations.accept(this.relations);
        }

        if (expr.sorts) {
            expr.sorts.accept(this.sort);
        }

        return this.serializer;
    }

    visitFields(expr: Fields): RecordArraySerializer {
        return expr.accept(this.fields);
    }

    visitField(expr: Field): RecordArraySerializer {
        return expr.accept(this.fields);
    }

    visitFilter(expr: Filter): RecordSerializer {
        return expr.accept(this.filters);
    }

    visitFilters(expr: Filters): RecordSerializer {
        return expr.accept(this.filters);
    }

    visitPagination(expr: Pagination): RecordSerializer {
        return expr.accept(this.pagination);
    }

    visitRelation(expr: Relation): ArraySerializer {
        return expr.accept(this.relations);
    }

    visitRelations(expr: Relations): ArraySerializer {
        return expr.accept(this.relations);
    }

    visitSort(expr: Sort): ArraySerializer {
        return expr.accept(this.sort);
    }

    visitSorts(expr: Sorts): ArraySerializer {
        return expr.accept(this.sort);
    }
}
