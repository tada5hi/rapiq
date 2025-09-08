/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum FilterFieldOperator {
    EQUAL = 'eq',
    NOT_EQUAL = 'ne',

    LESS_THAN_EQUAL = 'lte',
    LESS_THAN = 'lt',

    GREATER_THAN_EQUAL = 'gte',
    GREATER_THAN = 'gt',

    IN = 'in',
    NOT_IN = 'nin',

    REGEX = 'regex',

    // todo: new
    MOD = 'mod',
    EXISTS = 'exists',
    WITHIN = 'within',
    ELEM_MATCH = 'elemMatch',
}

export enum FilterCompoundOperator {
    AND = 'and',
    OR = 'or',
}

export enum FilterInputOperatorValue {
    NEGATION = '!',
    LIKE = '~',
    LESS_THAN_EQUAL = '<=',
    LESS_THAN = '<',
    GREATER_THAN_EQUAL = '>=',
    GREATER_THAN = '>',
}
