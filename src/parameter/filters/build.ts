/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FiltersBuildInput } from './type';
import { FilterOperator } from './constants';
import { isFilterOperatorConfig } from './utils';
import { flattenNestedObject, mergeDeep } from '../../utils';

export function buildQueryFiltersForMany<T>(
    input: FiltersBuildInput<T>[],
) : Record<string, string> {
    let data : FiltersBuildInput<T>;
    for (let i = 0; i < input.length; i++) {
        if (data) {
            data = mergeDeep(data, input[i]);
        } else {
            data = input[i];
        }
    }

    return buildQueryFilters(data);
}

export function buildQueryFilters<T>(
    data: FiltersBuildInput<T>,
) : Record<string, string> {
    return flattenNestedObject(data, {
        transformer: (input, output, key) => {
            if (typeof input === 'undefined') {
                output[key] = null;

                return undefined;
            }

            if (isFilterOperatorConfig(input)) {
                input.value = transformValue(input.value);

                if (Array.isArray(input.operator)) {
                    // merge operators
                    input.operator = input.operator
                        .sort((a, b) => OperatorWeight[a] - OperatorWeight[b])
                        .join('') as FilterOperator;
                }

                output[key] = `${input.operator}${input.value}`;
            }

            return undefined;
        },
    });
}

const OperatorWeight = {
    [FilterOperator.NEGATION]: 0,
    [FilterOperator.LIKE]: 50,
    [FilterOperator.LESS_THAN_EQUAL]: 150,
    [FilterOperator.LESS_THAN]: 450,
    [FilterOperator.MORE_THAN_EQUAL]: 1350,
    [FilterOperator.MORE_THAN]: 4050,
    [FilterOperator.IN]: 13105,
};

function transformValue<T>(value: T) : T | null {
    if (typeof value === 'undefined') {
        return null;
    }

    return value;
}
