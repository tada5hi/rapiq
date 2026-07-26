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
    createFieldConditionRedactor,
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
        // a gated field needs the projector even without a pick,
        // to redact it out of the otherwise untouched record.
        const hasConditions = expr.fields.value.some(
            (field) => !!field.condition,
        );
        if (hasPicks || hasConditions) {
            projector = expr.fields.accept(new FieldsVisitor<T>({
                relations,
                filters: this.options.filters,
            }));
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

/**
 * Compile the visibility gates carried by a fields parameter
 * (`Field.condition`) into a redactor for a single record.
 *
 * A gated field is only visible on records satisfying its condition; on a
 * record that fails it, the key is omitted from the output. The condition
 * never removes the record itself. Records with nothing to hide are
 * returned by reference; otherwise a shallow redacted copy is built along
 * the affected path. The input is never mutated.
 *
 * `@rapiq/memory`'s own projector applies this automatically. It is
 * exported for `@rapiq/sql` / `@rapiq/typeorm` consumers, which project
 * the column unconditionally (a selection must stay a bare column for
 * entity hydration) and therefore have to enforce the gates after the
 * fetch. See {@link applyFieldConditions} for the array form.
 */
export function compileFieldConditions<T = Record<string, any>>(
    input: IFields,
    options: FiltersVisitorOptions = {},
) : Projector<T> {
    const redactor = createFieldConditionRedactor<T>(input.value, options);

    return redactor || ((record) => record);
}

/**
 * Apply the visibility gates carried by a fields parameter
 * (`Field.condition`) to already-fetched records.
 *
 * Returns a new array; each record is either passed through by reference
 * (nothing to hide) or replaced by a redacted copy with the failing keys
 * omitted. No record is ever removed and the input is never mutated.
 *
 * ```ts
 * const entities = await queryBuilder.getMany();
 * const output = applyFieldConditions(query.fields, entities);
 * ```
 */
export function applyFieldConditions<T = Record<string, any>>(
    input: IFields,
    data: T[],
    options: FiltersVisitorOptions = {},
) : T[] {
    const redactor = createFieldConditionRedactor<T>(input.value, options);
    if (!redactor) {
        return [...data];
    }

    return data.map(redactor);
}
