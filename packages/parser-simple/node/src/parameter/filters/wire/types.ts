/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FILTER_OPERATOR_SEMANTICS, FilterFieldOperator } from '@rapiq/core';
import type {
    FILTER_WIRE_NEGATION,
    FILTER_WIRE_SPEC,
    FilterWireDecodeFailure,
} from './constants';

/**
 * How a row treats the text between its markers:
 * 'coerced' — value normalization applies (scalar coercion, comma split);
 * 'raw' — inner text travels verbatim (the anchored-match/LIKE family).
 */
export type FilterWireValueMode = 'coerced' | 'raw';

/**
 * One row of the wire grammar: the marker spelling of one positive
 * operator. Negation twins are NOT rows — they derive from
 * {@link FILTER_WIRE_NEGATION} plus the complementOf relation in
 * core's FILTER_OPERATOR_SEMANTICS.
 */
export type FilterWireMarkerSpec = {
    prefix: string,
    suffix: string,
    value: FilterWireValueMode,
};

/**
 * The operator + typed value a single wire value expresses.
 */
export type FilterWireCondition = {
    operator: `${FilterFieldOperator}`,
    value: unknown,
};

/**
 * Encode input — structurally satisfied by a core Filter leaf, whose
 * operator is a plain string (unknown operators throw a typed
 * AdapterError at runtime, as the encoder's switch default always
 * did). `field` is optional error-message context only.
 */
export type FilterWireEncodeInput = {
    operator: string,
    value: unknown,
    field?: string,
};

/**
 * Decode verdict — failures are the caller's policy (the parser
 * applies the schema drop-vs-throw rule), so decode never throws.
 */
export type FilterWireDecodeResult =    { success: true, condition: FilterWireCondition } |
    { success: false, code: FilterWireDecodeFailure };

// ---------------------------------------------------------
// Type-level derivation — the third spelling of the grammar,
// computed from the same table that drives decode and encode.
// ---------------------------------------------------------

type Spec = typeof FILTER_WIRE_SPEC;
type Negation = typeof FILTER_WIRE_NEGATION;

/**
 * Operators that are the target of a complementOf relation in core's
 * semantics table — i.e. positive operators owning a negation twin.
 */
type ComplementTargets = {
    [K in keyof typeof FILTER_OPERATOR_SEMANTICS]:
    (typeof FILTER_OPERATOR_SEMANTICS)[K] extends { complementOf: infer C extends string } ?
        C :
        never
}[keyof typeof FILTER_OPERATOR_SEMANTICS];

/**
 * Table rows whose spelling composes with the negation modifier.
 * The ordering family (lt, lte, gt, gte) has no complement — a
 * leading '!' before those markers is discarded on decode (frozen
 * v1 quirk), so no '!' spellings are advertised for them.
 */
export type NegatableWireOperator = Extract<keyof Spec, ComplementTargets>;

/**
 * A row's positive spelling. The empty-marker row (eq) contributes
 * the value ITSELF (5, not '5' — decode routes non-string scalars to
 * equality), not its string image.
 */
type RowSpelling<P extends string, S extends string, V extends string | number> =    [P, S] extends ['', ''] ? V : `${P}${V}${S}`;

type PositiveSpelling<V extends string | number> = {
    [K in keyof Spec]: RowSpelling<Spec[K]['prefix'], Spec[K]['suffix'], V>
}[keyof Spec];

type NegatedSpelling<V extends string | number> = {
    [K in NegatableWireOperator]: `${Negation}${Spec[K]['prefix']}${V}${Spec[K]['suffix']}`
}[NegatableWireOperator];

/**
 * Every marker spelling of a scalar V the wire grammar accepts —
 * derived from {@link FILTER_WIRE_SPEC}, so the typed parser input
 * can never drift from the runtime grammar again.
 */
export type FilterWireSpelling<V extends string | number> =    PositiveSpelling<V> | NegatedSpelling<V>;

/**
 * The typed-parser input domain for a scalar value V. The null
 * members are a value-domain carve-out (nullable equality), not
 * marker rows; booleans deliberately advertise no marker forms
 * ('!true' decodes to ne true, which under the complement law also
 * matches null/missing — it is NOT eq false).
 */
export type FilterWireValueInput<V> = V extends string | number ?
    FilterWireSpelling<V> | null | `${Negation}null` :
    V extends boolean ?
        V | null | `${Negation}null` :
        never;
