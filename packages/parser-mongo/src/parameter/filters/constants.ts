/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterFieldOperator } from '@rapiq/core';

/**
 * Compound (document-level) operators of the mongo dialect.
 */
export const MONGO_COMPOUND_OPERATORS = [
    '$and',
    '$or',
    '$nor',
] as const;

export type MongoCompoundOperator = typeof MONGO_COMPOUND_OPERATORS[number];

/**
 * Field-level operators with a direct AST mapping, keyed by their
 * `$`-prefixed wire name: [operator, negated counterpart]. Negation
 * (via `$not` or a `$nor` context) flips to the counterpart.
 */
export const MONGO_COMPARISON_OPERATORS = {
    $eq: [FilterFieldOperator.EQUAL, FilterFieldOperator.NOT_EQUAL],
    $ne: [FilterFieldOperator.NOT_EQUAL, FilterFieldOperator.EQUAL],
    $lt: [FilterFieldOperator.LESS_THAN, FilterFieldOperator.GREATER_THAN_EQUAL],
    $lte: [FilterFieldOperator.LESS_THAN_EQUAL, FilterFieldOperator.GREATER_THAN],
    $gt: [FilterFieldOperator.GREATER_THAN, FilterFieldOperator.LESS_THAN_EQUAL],
    $gte: [FilterFieldOperator.GREATER_THAN_EQUAL, FilterFieldOperator.LESS_THAN],
    $in: [FilterFieldOperator.IN, FilterFieldOperator.NOT_IN],
    $nin: [FilterFieldOperator.NOT_IN, FilterFieldOperator.IN],
    $startsWith: [FilterFieldOperator.STARTS_WITH, FilterFieldOperator.NOT_STARTS_WITH],
    $notStartsWith: [FilterFieldOperator.NOT_STARTS_WITH, FilterFieldOperator.STARTS_WITH],
    $endsWith: [FilterFieldOperator.ENDS_WITH, FilterFieldOperator.NOT_ENDS_WITH],
    $notEndsWith: [FilterFieldOperator.NOT_ENDS_WITH, FilterFieldOperator.ENDS_WITH],
    $contains: [FilterFieldOperator.CONTAINS, FilterFieldOperator.NOT_CONTAINS],
    $notContains: [FilterFieldOperator.NOT_CONTAINS, FilterFieldOperator.CONTAINS],
} as const;

export type MongoComparisonOperator = keyof typeof MONGO_COMPARISON_OPERATORS;

/**
 * The complete field-level operator vocabulary — a key of this list at
 * document level is a grammar error (and vice versa for compounds).
 */
export const MONGO_FIELD_OPERATORS : readonly string[] = [
    ...Object.keys(MONGO_COMPARISON_OPERATORS),
    '$regex',
    '$options',
    '$mod',
    '$exists',
    '$elemMatch',
    '$not',
];

/**
 * Known mongo operators without an AST counterpart — they throw a typed
 * operatorUnsupported error instead of the generic unknown-operator error.
 */
export const MONGO_UNSUPPORTED_OPERATORS : readonly string[] = [
    '$size',
    '$all',
    '$type',
    '$where',
    '$text',
    '$expr',
    '$jsonSchema',
    '$geoWithin',
    '$geoIntersects',
    '$near',
    '$nearSphere',
    '$bitsAllSet',
    '$bitsAllClear',
    '$bitsAnySet',
    '$bitsAnyClear',
    '$comment',
    '$slice',
];
