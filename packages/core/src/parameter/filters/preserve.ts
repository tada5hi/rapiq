/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator } from '../../schema';
import type { ICondition } from './condition';
import { Filters, isFilters } from './collection';
import type { IFilters } from './collection';
import { Filter, isFilter } from './record';
import type { IFilter } from './record';

export function preserve<OP extends string, V>(condition: IFilter<OP, V>): IFilter<OP, V>;
export function preserve<T extends ICondition>(condition: IFilters<T>): IFilters<T>;
export function preserve(condition: ICondition): IFilters;
export function preserve(condition: ICondition): IFilter | IFilters {
    if (isFilter(condition)) {
        return condition.preserved ? condition :
            new Filter(condition.operator, condition.field, condition.value, { preserved: true });
    }

    if (isFilters(condition)) {
        return condition.preserved ? condition :
            new Filters(condition.operator, condition.value, { preserved: true });
    }

    return new Filters(FilterCompoundOperator.AND, [condition], { preserved: true });
}
