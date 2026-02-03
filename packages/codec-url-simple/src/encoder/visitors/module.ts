/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IField,
    IFieldVisitor,
    IFields,
    IFieldsVisitor,
    IFilter,
    IFilterVisitor,
    IFilters,
    IFiltersVisitor,
    IPagination,
    IPaginationVisitor,
    IQuery,
    IQueryVisitor,
    IRelation,
    IRelationVisitor,
    IRelations,
    IRelationsVisitor,
    ISort,
    ISortVisitor,
    ISorts,
    ISortsVisitor,
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

    visitQuery(expr: IQuery): QuerySerializer {
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

    visitFields(expr: IFields): RecordArraySerializer {
        return expr.accept(this.fields);
    }

    visitField(expr: IField): RecordArraySerializer {
        return expr.accept(this.fields);
    }

    visitFilter(expr: IFilter): RecordSerializer {
        return expr.accept(this.filters);
    }

    visitFilters(expr: IFilters): RecordSerializer {
        return expr.accept(this.filters);
    }

    visitPagination(expr: IPagination): RecordSerializer {
        return expr.accept(this.pagination);
    }

    visitRelation(expr: IRelation): ArraySerializer {
        return expr.accept(this.relations);
    }

    visitRelations(expr: IRelations): ArraySerializer {
        return expr.accept(this.relations);
    }

    visitSort(expr: ISort): ArraySerializer {
        return expr.accept(this.sort);
    }

    visitSorts(expr: ISorts): ArraySerializer {
        return expr.accept(this.sort);
    }
}
