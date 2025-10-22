/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

export enum FilterTokenType {
    NOT = 'NOT',

    AND = 'AND',
    OR = 'OR',

    EQUAL = 'eq',
    GREATER_THAN = 'gt',
    GREATER_OR_EQUAL = 'gte',
    LESS_THAN = 'lt',
    LESS_OR_EQUAL = 'lte',
    CONTAINS = 'like',
    STARTS_WITH = 'startsWith',
    ENDS_WITH = 'endsWith',
    IN = 'in',
    NIN = 'nin',

    FIELD = 'FIELD',
    ESCAPED_TEXT = 'ESCAPED_TEXT',
    NULL = 'NULL',
    LPAREN = 'LPAREN',
    RPAREN = 'RPAREN',
    COMMA = 'COMMA',
    EOF = 'EOF',
}
