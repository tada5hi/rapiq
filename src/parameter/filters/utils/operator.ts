/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterComparisonOperator, FilterInputOperatorValue } from '../constants';
import type { FilterValueSimple } from '../type';

function matchOperator(key: string, value: FilterValueSimple, position: 'start' | 'end' | 'global') : FilterValueSimple | undefined {
    if (typeof value === 'string') {
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

    if (Array.isArray(value)) {
        let match = false;
        for (let i = 0; i < value.length; i++) {
            const output = matchOperator(key, value[i], position);
            if (typeof output !== 'undefined') {
                match = true;
                value[i] = output as string | number;
            }
        }

        if (match) {
            return value;
        }
    }

    return undefined;
}

export function parseFilterValue(input: FilterValueSimple) : {
    operator: `${FilterComparisonOperator}`,
    value: FilterValueSimple
} {
    if (
        typeof input === 'string' &&
        input.includes(FilterInputOperatorValue.IN)
    ) {
        input = input.split(FilterInputOperatorValue.IN);
    }

    let negation = false;

    let value = matchOperator(FilterInputOperatorValue.NEGATION, input, 'start');
    if (typeof value !== 'undefined') {
        negation = true;
        input = value;
    }

    if (Array.isArray(input)) {
        return {
            value: input,
            operator: negation ?
                FilterComparisonOperator.NOT_IN :
                FilterComparisonOperator.IN,
        };
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

    return {
        value: input,
        operator: negation ?
            FilterComparisonOperator.NOT_EQUAL :
            FilterComparisonOperator.EQUAL,
    };
}
