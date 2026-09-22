/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IAggregate,
    IAggregateVisitor,
    IAggregates,
    IAggregatesVisitor,
    IField,
    IFieldVisitor,
    IFields,
    IFieldsVisitor,
    IFilter,
    IFilterVisitor,
    IFilters,
    IFiltersVisitor,
    IGroup,
    IGroupVisitor,
    IGroups,
    IGroupsVisitor,
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
import { Parameter } from '@rapiq/core';
import type { ArraySerializer, RecordArraySerializer, RecordSerializer } from '../serializer';
import { QuerySerializer } from '../serializer';
import { includesParameter } from '../../../utils';
import { AggregatesVisitor } from './aggregates';
import { FieldsVisitor } from './fields';
import { FiltersVisitor } from './filters';
import { GroupsVisitor } from './groups';
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
    ISortVisitor<ArraySerializer>,
    IGroupsVisitor<ArraySerializer>,
    IGroupVisitor<ArraySerializer>,
    IAggregatesVisitor<ArraySerializer>,
    IAggregateVisitor<ArraySerializer> {
    protected serializer : QuerySerializer;

    protected fields: FieldsVisitor;

    protected filters : FiltersVisitor;

    protected pagination : PaginationVisitor;

    protected relations: RelationsVisitor;

    protected sorts : SortsVisitor;

    protected groups : GroupsVisitor;

    protected aggregates : AggregatesVisitor;

    constructor() {
        const serializer = new QuerySerializer();
        this.serializer = serializer;

        this.fields = new FieldsVisitor(serializer.fields);
        this.filters = new FiltersVisitor(serializer.filters);
        this.pagination = new PaginationVisitor(serializer.pagination);
        this.relations = new RelationsVisitor(serializer.relations);
        this.sorts = new SortsVisitor(serializer.sorts);
        this.groups = new GroupsVisitor(serializer.groups);
        this.aggregates = new AggregatesVisitor(serializer.aggregates);
    }

    reset() : void {
        this.serializer.reset();
    }

    /**
     * The optional parameter list limits which parameters are
     * emitted — same semantics as `ParseQueryOptions.parameters`.
     */
    visitQuery(expr: IQuery, parameters?: `${Parameter}`[]): QuerySerializer {
        if (!parameters || parameters.includes(Parameter.FIELDS)) {
            expr.fields.accept(this.fields);
        }

        if (!parameters || parameters.includes(Parameter.FILTERS)) {
            expr.filters.accept(this.filters);
        }

        if (!parameters || parameters.includes(Parameter.PAGINATION)) {
            expr.pagination.accept(this.pagination);
        }

        if (!parameters || parameters.includes(Parameter.RELATIONS)) {
            expr.relations.accept(this.relations);
        }

        if (!parameters || includesParameter(parameters, Parameter.SORTS)) {
            expr.sorts.accept(this.sorts);
        }

        // optional on IQuery: an external producer may not carry them.
        if (expr.groups && (!parameters || parameters.includes(Parameter.GROUPS))) {
            expr.groups.accept(this.groups);
        }

        if (expr.aggregates && (!parameters || parameters.includes(Parameter.AGGREGATES))) {
            expr.aggregates.accept(this.aggregates);
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
        return expr.accept(this.sorts);
    }

    visitSorts(expr: ISorts): ArraySerializer {
        return expr.accept(this.sorts);
    }

    visitGroup(expr: IGroup): ArraySerializer {
        return expr.accept(this.groups);
    }

    visitGroups(expr: IGroups): ArraySerializer {
        return expr.accept(this.groups);
    }

    visitAggregate(expr: IAggregate): ArraySerializer {
        return expr.accept(this.aggregates);
    }

    visitAggregates(expr: IAggregates): ArraySerializer {
        return expr.accept(this.aggregates);
    }
}
