/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterComparisonOperator, FilterInputOperatorValue } from '../constants';

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
