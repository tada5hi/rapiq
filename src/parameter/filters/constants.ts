/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum FilterOperatorLabel {
    NEGATION = 'negation',
    LIKE = 'like',
    LESS_THAN_EQUAL = 'lessThanEqual',
    LESS_THAN = 'lessThan',
    MORE_THAN_EQUAL = 'moreThanEqual',
    MORE_THAN = 'moreThan',
    IN = 'in',
}

export enum FilterOperator {
    NEGATION = '!',
    LIKE = '~',
    LESS_THAN_EQUAL = '<=',
    LESS_THAN = '<',
    MORE_THAN_EQUAL = '>=',
    MORE_THAN = '>',
    IN = ',',
}
