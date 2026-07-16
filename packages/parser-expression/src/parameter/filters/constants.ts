/*
 * Copyright (c) 2025-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
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
    DOT = 'DOT',
    EOF = 'EOF',
}

/**
 * Grammar keywords of the expression dialect mapped to the token
 * they classify as. The tokenizer classifies whole identifiers
 * against this map; encoders consume its keys to reject field
 * segments that would tokenize as an operator on decode.
 */
export const FILTER_EXPRESSION_KEYWORDS = {
    not: FilterTokenType.NOT,
    and: FilterTokenType.AND,
    or: FilterTokenType.OR,
    eq: FilterTokenType.EQUAL,
    gt: FilterTokenType.GREATER_THAN,
    gte: FilterTokenType.GREATER_OR_EQUAL,
    lt: FilterTokenType.LESS_THAN,
    lte: FilterTokenType.LESS_OR_EQUAL,
    contains: FilterTokenType.CONTAINS,
    startsWith: FilterTokenType.STARTS_WITH,
    endsWith: FilterTokenType.ENDS_WITH,
    in: FilterTokenType.IN,
    nin: FilterTokenType.NIN,
    null: FilterTokenType.NULL,
} as const satisfies Record<string, FilterTokenType>;

/**
 * Identifier grammar of a single field segment as accepted by the
 * expression tokenizer (unanchored regex source; consumers anchor
 * it as needed).
 */
export const FILTER_FIELD_SEGMENT_PATTERN = '[A-Za-z0-9_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?';
