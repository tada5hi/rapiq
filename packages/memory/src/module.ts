/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ICondition,
    IFields,
    IPagination,
    IQuery,
    IQueryVisitor,
    ISorts,
} from '@rapiq/core';
import { FieldOperator } from '@rapiq/core';
import type { FieldsVisitorOptions, FiltersVisitorOptions } from './parameter';
import {
    FieldsVisitor,
    FiltersVisitor,
    PaginationVisitor,
    RelationsVisitor,
    SortsVisitor,
} from './parameter';
import { CompiledQuery } from './query';
import type {
    ApplyOutput,
    Comparator,
    Predicate,
    Projector,
    Slicer,
} from './types';

export type QueryVisitorOptions = {
    filters?: FiltersVisitorOptions,
};

export class QueryVisitor<T = Record<string, any>> implements IQueryVisitor<CompiledQuery<T>> {
    protected options : QueryVisitorOptions;

    constructor(options: QueryVisitorOptions = {}) {
        this.options = options;
    }

    visitQuery(expr: IQuery) : CompiledQuery<T> {
        const relations = expr.relations.accept(new RelationsVisitor());

        let projector : Projector<T> | undefined;
        const hasPicks = expr.fields.value.some(
            (field) => field.operator !== FieldOperator.EXCLUDE,
        );
        if (hasPicks) {
            projector = expr.fields.accept(new FieldsVisitor<T>({ relations }));
        }

        let comparator : Comparator<T> | undefined;
        if (expr.sorts.value.length > 0) {
            comparator = expr.sorts.accept(new SortsVisitor<T>());
        }

        return new CompiledQuery<T>({
            predicate: expr.filters.accept(new FiltersVisitor(this.options.filters)),
            comparator,
            projector,
            slicer: expr.pagination.accept(new PaginationVisitor()),
            pagination: {
                limit: expr.pagination.limit,
                offset: expr.pagination.offset,
            },
        });
    }
}

// -----------------------------------------------------------

export function compileQuery<T = Record<string, any>>(
    query: IQuery,
    options: QueryVisitorOptions = {},
) : CompiledQuery<T> {
    return query.accept(new QueryVisitor<T>(options));
}

export function applyQuery<T = Record<string, any>>(
    query: IQuery,
    data: T[],
    options: QueryVisitorOptions = {},
) : ApplyOutput<T> {
    return compileQuery<T>(query, options).apply(data);
}

export function compileFilters(
    input: ICondition,
    options: FiltersVisitorOptions = {},
) : Predicate {
    return new FiltersVisitor(options).compile(input);
}

export function compileSorts<T = Record<string, any>>(input: ISorts) : Comparator<T> {
    return input.accept(new SortsVisitor<T>());
}

export function compileFields<T = Record<string, any>>(
    input: IFields,
    options: FieldsVisitorOptions = {},
) : Projector<T> {
    return input.accept(new FieldsVisitor<T>(options));
}

export function compilePagination(input: IPagination) : Slicer {
    return input.accept(new PaginationVisitor());
}
