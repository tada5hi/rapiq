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
 * from this table; {@link Filter.accept} derives its per-operator
 * visitor dispatch from the `visitorMethod` column. Adding an
 * operator means adding a row (plus a lowering rule when it opens
 * a new family) — not editing backends.
 */
export const FILTER_OPERATOR_SEMANTICS = {
    eq: {
        family: 'equality',
        visitorMethod: 'visitFilterEqual',
        foldable: true,
    },
    ne: {
        family: 'equality',
        complementOf: 'eq',
        visitorMethod: 'visitFilterNotEqual',
        foldable: true,
    },
    lt: {
        family: 'ordering',
        visitorMethod: 'visitFilterLessThan',
        compare: { min: -1, max: -1 },
        foldable: false,
    },
    lte: {
        family: 'ordering',
        visitorMethod: 'visitFilterLessThanEqual',
        compare: { min: -1, max: 0 },
        foldable: false,
    },
    gt: {
        family: 'ordering',
        visitorMethod: 'visitFilterGreaterThan',
        compare: { min: 1, max: 1 },
        foldable: false,
    },
    gte: {
        family: 'ordering',
        visitorMethod: 'visitFilterGreaterThanEqual',
        compare: { min: 0, max: 1 },
        foldable: false,
    },
    in: {
        family: 'membership',
        visitorMethod: 'visitFilterIn',
        foldable: true,
    },
    nin: {
        family: 'membership',
        complementOf: 'in',
        visitorMethod: 'visitFilterNotIn',
        foldable: true,
    },
    startsWith: {
        family: 'anchored',
        visitorMethod: 'visitFilterStartsWith',
        anchor: { start: true, end: false },
        foldable: false,
    },
    notStartsWith: {
        family: 'anchored',
        complementOf: 'startsWith',
        visitorMethod: 'visitFilterNotStartsWith',
        anchor: { start: true, end: false },
        foldable: false,
    },
    endsWith: {
        family: 'anchored',
        visitorMethod: 'visitFilterEndsWith',
        anchor: { start: false, end: true },
        foldable: false,
    },
    notEndsWith: {
        family: 'anchored',
        complementOf: 'endsWith',
        visitorMethod: 'visitFilterNotEndsWith',
        anchor: { start: false, end: true },
        foldable: false,
    },
    contains: {
        family: 'anchored',
        visitorMethod: 'visitFilterContains',
        anchor: { start: false, end: false },
        foldable: false,
    },
    notContains: {
        family: 'anchored',
        complementOf: 'contains',
        visitorMethod: 'visitFilterNotContains',
        anchor: { start: false, end: false },
        foldable: false,
    },
    regex: {
        family: 'regex',
        visitorMethod: 'visitFilterRegex',
        foldable: false,
    },
    mod: {
        family: 'arithmetic',
        visitorMethod: 'visitFilterMod',
        foldable: false,
    },
    size: {
        family: 'cardinality',
        visitorMethod: 'visitFilterSize',
        foldable: false,
    },
    exists: {
        family: 'existence',
        visitorMethod: 'visitFilterExists',
        foldable: false,
    },
    elemMatch: {
        family: 'structural',
        visitorMethod: 'visitFilterElemMatch',
        foldable: false,
    },
} satisfies Record<`${FilterFieldOperator}`, FilterOperatorSemantics>;
