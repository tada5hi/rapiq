/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '@rapiq/core';
import {
    Filter,
    FilterFieldOperator,
    Filters,
    isFilter,
    isFilters,
    isObject,
} from '@rapiq/core';

/**
 * The serialized filter IR shared with the Rust port: the
 * language-neutral form of a built-in condition tree, with an explicit
 * `type` discriminant.
 */
export type FilterIR = {
    type: 'filter',
    operator: string,
    field: string,
    value: unknown,
};

export type FiltersIR = {
    type: 'filters',
    operator: string,
    value: ConditionIR[],
};

export type ConditionIR = FilterIR | FiltersIR;

export function toIR(input: ICondition) : ConditionIR {
    if (isFilters(input)) {
        return {
            type: 'filters',
            operator: input.operator,
            value: input.value.map((child) => toIR(child)),
        };
    }

    if (isFilter(input)) {
        // only an elemMatch interior is a condition; any other value
        // (including a malformed elemMatch value) is plain data.
        const value = input.operator === FilterFieldOperator.ELEM_MATCH && isNode(input.value) ?
            toIR(input.value) :
            input.value;

        return {
            type: 'filter',
            operator: input.operator,
            field: input.field,
            value,
        };
    }

    throw new Error(`The condition ${input.operator} has no IR form.`);
}

export function fromIR(input: ConditionIR) : ICondition {
    if (input.type === 'filters') {
        return new Filters(input.operator, input.value.map((child) => fromIR(child)));
    }

    const value = input.operator === FilterFieldOperator.ELEM_MATCH && isNodeIR(input.value) ?
        fromIR(input.value) :
        input.value;

    return new Filter(input.operator, input.field, value);
}

function isNode(input: unknown) : input is ICondition {
    return isFilter(input as ICondition) || isFilters(input as ICondition);
}

function isNodeIR(input: unknown) : input is ConditionIR {
    const type = isObject(input) ? input.type : undefined;

    return type === 'filter' || type === 'filters';
}
