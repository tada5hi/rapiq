/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator } from '@rapiq/core';
import type { FilterWireMarkerSpec } from './types';

/**
 * The negation modifier — a prefix phase applied before row
 * matching, not a row. It binds only to rows whose operator has a
 * complementOf twin in core's FILTER_OPERATOR_SEMANTICS; elsewhere
 * a stripped '!' is silently discarded (frozen v1 wire quirk:
 * '!<=5' decodes as lte 5).
 */
export const FILTER_WIRE_NEGATION = '!' as const;

/**
 * The marker grammar of the simple wire dialect — the single source
 * all three spellings derive from (runtime decode, runtime encode,
 * typed parser input).
 *
 * DECLARED ORDER IS DECODE PRECEDENCE: after the negation modifier
 * is stripped, the first row whose prefix AND suffix both match
 * wins. Load-bearing orderings, pinned by the self-shadowing probe
 * in the wire spec:
 * - anchored (LIKE) rows before comparisons ('~<5' is endsWith '<5');
 * - contains before endsWith/startsWith ('~x~' is contains 'x');
 * - '<=' before '<', '>=' before '>';
 * - eq (empty markers) LAST — the residual catch-all.
 *
 * The in/nin membership operators own no rows: they are a value
 * SHAPE (comma-joined list), rendered through the eq spelling and
 * lifted on decode.
 */
export const FILTER_WIRE_SPEC = {
    contains: {
        prefix: '~', 
        suffix: '~', 
        value: 'raw', 
    },
    endsWith: {
        prefix: '~', 
        suffix: '', 
        value: 'raw', 
    },
    startsWith: {
        prefix: '', 
        suffix: '~', 
        value: 'raw', 
    },
    lte: {
        prefix: '<=', 
        suffix: '', 
        value: 'coerced', 
    },
    lt: {
        prefix: '<', 
        suffix: '', 
        value: 'coerced', 
    },
    gte: {
        prefix: '>=', 
        suffix: '', 
        value: 'coerced', 
    },
    gt: {
        prefix: '>', 
        suffix: '', 
        value: 'coerced', 
    },
    eq: {
        prefix: '', 
        suffix: '', 
        value: 'coerced', 
    },
} as const satisfies Partial<Record<`${FilterFieldOperator}`, FilterWireMarkerSpec>>;

/**
 * Why a wire value failed to decode into a condition. Both codes
 * funnel into the same drop-vs-throw policy in the parser; they are
 * distinguished for diagnostics only.
 */
export const FilterWireDecodeFailure = {
    /** input could not be normalized to a scalar/array wire value. */
    VALUE_INVALID: 'valueInvalid',
    /** the value decoded to an empty-string condition value ('', '!', '<=', '~~'). */
    VALUE_EMPTY: 'valueEmpty',
} as const;

export type FilterWireDecodeFailure =    typeof FilterWireDecodeFailure[keyof typeof FilterWireDecodeFailure];
