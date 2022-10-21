/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty, isSimpleValue } from '../../../utils';
import { FilterComparisonOperator, FilterInputOperatorValue } from '../constants';
import { FilterValueConfig } from '../type';

function matchOperator(key: string, value: string, position: 'start' | 'end' | 'global') : string | undefined {
    switch (position) {
        case 'start': {
            if (value.substring(0, key.length) === key) {
                return value.substring(key.length);
            }
            break;
        }
        case 'end': {
            if (value.substring(0 - key.length) === key) {
                return value.substring(0, value.length - key.length - 1);
            }
            break;
        }
    }

    return undefined;
}

export function parseFilterValue(input: string) : {
    operator: `${FilterComparisonOperator}`,
    value: string | string[]
} {
    let negation = false;

    let value = matchOperator(FilterInputOperatorValue.NEGATION, input, 'start');
    if (typeof value !== 'undefined') {
        negation = true;
        input = value;
    }

    value = matchOperator(FilterInputOperatorValue.LIKE, input, 'start');
    if (typeof value !== 'undefined') {
        return {
            value,
            operator: negation ?
                FilterComparisonOperator.NOT_LIKE :
                FilterComparisonOperator.LIKE,
        };
    }

    value = matchOperator(FilterInputOperatorValue.LESS_THAN_EQUAL, input, 'start');
    if (typeof value !== 'undefined') {
        return {
            value,
            operator: FilterComparisonOperator.LESS_THAN_EQUAL,
        };
    }

    value = matchOperator(FilterInputOperatorValue.LESS_THAN, input, 'start');
    if (typeof value !== 'undefined') {
        return {
            value,
            operator: FilterComparisonOperator.LESS_THAN,
        };
    }

    value = matchOperator(FilterInputOperatorValue.MORE_THAN_EQUAL, input, 'start');
    if (typeof value !== 'undefined') {
        return {
            value,
            operator: FilterComparisonOperator.GREATER_THAN_EQUAL,
        };
    }

    value = matchOperator(FilterInputOperatorValue.MORE_THAN, input, 'start');
    if (typeof value !== 'undefined') {
        return {
            value,
            operator: FilterComparisonOperator.GREATER_THAN,
        };
    }

    if (input.includes(FilterInputOperatorValue.IN)) {
        return {
            value: input.split(FilterInputOperatorValue.IN),
            operator: negation ?
                FilterComparisonOperator.NOT_IN :
                FilterComparisonOperator.IN,
        };
    }

    return {
        value: input,
        operator: negation ?
            FilterComparisonOperator.NOT_EQUAL :
            FilterComparisonOperator.EQUAL,
    };
}

export function isFilterValueConfig(data: unknown) : data is FilterValueConfig<any> {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    if (hasOwnProperty(data, 'operator')) {
        const operators : string[] = Object.values(FilterInputOperatorValue);

        if (typeof data.operator === 'string') {
            if (operators.indexOf(data.operator) === -1) {
                return false;
            }
        } else if (Array.isArray(data.operator)) {
            for (let i = 0; i < data.operator.length; i++) {
                if (typeof data.operator[i] !== 'string') {
                    return false;
                }

                if (operators.indexOf(data.operator[i]) === -1) {
                    return false;
                }
            }
        } else {
            return false;
        }
    } else {
        return false;
    }

    if (hasOwnProperty(data, 'value')) {
        if (
            !isSimpleValue(data.value, {
                withNull: true,
                withUndefined: true,
            })
        ) {
            if (Array.isArray(data.value)) {
                for (let i = 0; i < data.value.length; i++) {
                    if (!isSimpleValue(data.value[i])) {
                        return false;
                    }
                }
            } else {
                return false;
            }
        }
    } else {
        return false;
    }

    return true;
}
