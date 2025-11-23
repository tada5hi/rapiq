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

    STARTS_WITH = 'startsWith',
    NOT_STARTS_WITH = 'notStartsWith',

    ENDS_WITH = 'endsWith',
    NOT_ENDS_WITH = 'notEndsWith',

    CONTAINS = 'contains',
    NOT_CONTAINS = 'notContains',

    REGEX = 'regex',

    MOD = 'mod',
    EXISTS = 'exists',
    ELEM_MATCH = 'elemMatch',
}

export enum FilterCompoundOperator {
    AND = 'and',
    OR = 'or',
}
