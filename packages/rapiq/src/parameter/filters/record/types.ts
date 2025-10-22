/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator } from '../../../schema';
import type { Filters } from '../collection';
import type { Filter } from './module';

export interface IFilterVisitor<R> {
    visitFilter(expr: Filter): R;

    visitFilterEqual?(expr: Filter<FilterFieldOperator.EQUAL>) : R;

    visitFilterNotEqual?(expr: Filter<FilterFieldOperator.NOT_EQUAL>) : R;

    visitFilterLessThan?(expr: Filter<FilterFieldOperator.LESS_THAN>) : R;

    visitFilterLessThanEqual?(expr: Filter<FilterFieldOperator.LESS_THAN_EQUAL>) : R;

    visitFilterGreaterThan?(expr: Filter<FilterFieldOperator.GREATER_THAN>) : R;

    visitFilterGreaterThanEqual?(expr: Filter<FilterFieldOperator.GREATER_THAN_EQUAL>) : R;

    visitFilterExists?(expr: Filter<FilterFieldOperator.EXISTS, boolean>) : R;

    visitFilterIn?(expr: Filter<FilterFieldOperator.IN, unknown[]>) : R;

    visitFilterNotIn?(expr: Filter<FilterFieldOperator.NOT_IN, unknown[]>) : R;

    visitFilterMod?(expr: Filter<FilterFieldOperator.MOD, [number, number]>) : R;

    visitFilterElemMatch?(expr: Filter<FilterFieldOperator.ELEM_MATCH, Filter | Filters>) : R;

    visitFilterRegex?(expr: Filter<FilterFieldOperator.REGEX, RegExp>) : R;
}
