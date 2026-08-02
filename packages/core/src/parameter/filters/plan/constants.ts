/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator } from '../../../schema';
import type { FilterOperatorSemantics } from './types';

/**
 * The operator-semantics table — one row per filter operator, the
 * single source of truth for what an operator MEANS: its family,
 * its negation twin (complement law), its anchor placement, its
 * comparison range and its case-fold participation.
 *
 * The {@link planCondition} lowering derives every policy decision
 * from this table. Adding an operator means adding a row (plus a
 * lowering rule when it opens a new family) — not editing backends.
 */
export const FILTER_OPERATOR_SEMANTICS = {
    eq: {
        family: 'equality',
        foldable: true,
    },
    ne: {
        family: 'equality',
        complementOf: 'eq',
        foldable: true,
    },
    lt: {
        family: 'ordering',
        compare: { min: -1, max: -1 },
        foldable: false,
    },
    lte: {
        family: 'ordering',
        compare: { min: -1, max: 0 },
        foldable: false,
    },
    gt: {
        family: 'ordering',
        compare: { min: 1, max: 1 },
        foldable: false,
    },
    gte: {
        family: 'ordering',
        compare: { min: 0, max: 1 },
        foldable: false,
    },
    in: {
        family: 'membership',
        foldable: true,
    },
    nin: {
        family: 'membership',
        complementOf: 'in',
        foldable: true,
    },
    startsWith: {
        family: 'anchored',
        anchor: { start: true, end: false },
        foldable: false,
    },
    notStartsWith: {
        family: 'anchored',
        complementOf: 'startsWith',
        anchor: { start: true, end: false },
        foldable: false,
    },
    endsWith: {
        family: 'anchored',
        anchor: { start: false, end: true },
        foldable: false,
    },
    notEndsWith: {
        family: 'anchored',
        complementOf: 'endsWith',
        anchor: { start: false, end: true },
        foldable: false,
    },
    contains: {
        family: 'anchored',
        anchor: { start: false, end: false },
        foldable: false,
    },
    notContains: {
        family: 'anchored',
        complementOf: 'contains',
        anchor: { start: false, end: false },
        foldable: false,
    },
    regex: {
        family: 'regex',
        foldable: false,
    },
    mod: {
        family: 'arithmetic',
        foldable: false,
    },
    size: {
        family: 'cardinality',
        foldable: false,
    },
    exists: {
        family: 'existence',
        foldable: false,
    },
    elemMatch: {
        family: 'structural',
        foldable: false,
    },
} satisfies Record<`${FilterFieldOperator}`, FilterOperatorSemantics>;
