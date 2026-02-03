/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator } from '../../../schema';
import type { IFilters } from '../collection';

export interface IFilterVisitor<R> {
    visitFilter(expr: IFilter): R;

    visitFilterEqual?(expr: IFilter<FilterFieldOperator.EQUAL>) : R;
    visitFilterNotEqual?(expr: IFilter<FilterFieldOperator.NOT_EQUAL>) : R;

    visitFilterLessThan?(expr: IFilter<FilterFieldOperator.LESS_THAN>) : R;

    visitFilterLessThanEqual?(expr: IFilter<FilterFieldOperator.LESS_THAN_EQUAL>) : R;

    visitFilterGreaterThan?(expr: IFilter<FilterFieldOperator.GREATER_THAN>) : R;

    visitFilterGreaterThanEqual?(expr: IFilter<FilterFieldOperator.GREATER_THAN_EQUAL>) : R;

    visitFilterExists?(expr: IFilter<FilterFieldOperator.EXISTS, boolean>) : R;

    visitFilterIn?(expr: IFilter<FilterFieldOperator.IN, unknown[]>) : R;
    visitFilterNotIn?(expr: IFilter<FilterFieldOperator.NOT_IN, unknown[]>) : R;

    visitFilterMod?(expr: IFilter<FilterFieldOperator.MOD, [number, number]>) : R;

    visitFilterElemMatch?(expr: IFilter<FilterFieldOperator.ELEM_MATCH, IFilter | IFilters>) : R;

    visitFilterContains?(expr: IFilter<FilterFieldOperator.CONTAINS, unknown>) : R;
    visitFilterNotContains?(expr: IFilter<FilterFieldOperator.NOT_CONTAINS, unknown>) : R;

    visitFilterStartsWith?(expr: IFilter<FilterFieldOperator.STARTS_WITH, unknown>) : R;
    visitFilterNotStartsWith?(expr: IFilter<FilterFieldOperator.NOT_STARTS_WITH, unknown>) : R;

    visitFilterEndsWith?(expr: IFilter<FilterFieldOperator.ENDS_WITH, unknown>) : R;
    visitFilterNotEndsWith?(expr: IFilter<FilterFieldOperator.NOT_ENDS_WITH, unknown>) : R;

    visitFilterRegex?(expr: IFilter<FilterFieldOperator.REGEX, RegExp>) : R;
}

export interface IFilter<
    OPERATOR extends string = `${FilterFieldOperator}`,
    VALUE = unknown,
> {
    readonly field : string;

    readonly operator : string | OPERATOR;

    readonly value: VALUE;

    accept<R>(visitor: IFilterVisitor<R>) : R;
}
