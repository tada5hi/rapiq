/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum FilterComparisonOperator {
    EQUAL = '$eq',
    NOT_EQUAL = '$ne',
    LIKE = '$l',
    NOT_LIKE = '$nl',
    LESS_THAN_EQUAL = '$lte',
    LESS_THAN = '$lt',
    GREATER_THAN_EQUAL = '$gte',
    GREATER_THAN = '$gt',
    IN = '$in',
    NOT_IN = '$nin',
}

export enum FilterInputOperatorValue {
    NEGATION = '!',
    LIKE = '~',
    LESS_THAN_EQUAL = '<=',
    LESS_THAN = '<',
    MORE_THAN_EQUAL = '>=',
    MORE_THAN = '>',
    IN = ',',
}
