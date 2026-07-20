/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    FILTER_OPERATOR_SEMANTICS,
    FilterFieldOperator,
} from '@rapiq/core';
import type { Scalar } from '@rapiq/core';
import {
    FILTER_WIRE_NEGATION,
    FILTER_WIRE_SPEC,
    FilterWireDecodeFailure,
} from './constants';
import { parseFilterScalar } from './scalar';
import type {
    FilterWireCondition,
    FilterWireDecodeResult,
    FilterWireEncodeInput,
    FilterWireMarkerSpec,
} from './types';

/**
 * Decode precedence: the table's declared row order (G5).
 */
const ROWS = Object.entries(FILTER_WIRE_SPEC) as [
    keyof typeof FILTER_WIRE_SPEC,
    FilterWireMarkerSpec,
][];

/**
 * positive operator → its negation twin, inverted once from core's
 * semantics table so the wire grammar never re-states the
 * complement relation.
 */
const COMPLEMENT_OF : Partial<
    Record<`${FilterFieldOperator}`, `${FilterFieldOperator}`>
> = {};
const semanticKeys = Object.keys(FILTER_OPERATOR_SEMANTICS) as
(keyof typeof FILTER_OPERATOR_SEMANTICS)[];
for (const key of semanticKeys) {
    const semantics = FILTER_OPERATOR_SEMANTICS[key];
    if ('complementOf' in semantics) {
        COMPLEMENT_OF[semantics.complementOf] = key;
    }
}

/**
 * G2 — value-shape normalization: scalar coercion plus the
 * comma-split array convention, flattening and the frozen
 * falsy-filter quirk (drops ''/NaN, keeps 0/false/null).
 *
 * @param input
 */
function normalizeFilterValue(input: unknown) : Scalar | Scalar[] {
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.length === 0) {
            return trimmed;
        }

        const parts = trimmed.split(',');
        if (parts.length > 1) {
            return normalizeFilterValue(parts);
        }

        return parseFilterScalar(trimmed);
    }

    if (typeof input === 'number') {
        return input;
    }

    if (Array.isArray(input)) {
        const output : Scalar[] = [];

        for (const element of input) {
            const temp = normalizeFilterValue(element);
            if (Array.isArray(temp)) {
                output.push(...temp);
            } else {
                output.push(temp);
            }
        }

        return output
            .filter((n) => n === 0 || n === false || n === null || !!n);
    }

    if (typeof input === 'undefined' || input === null) {
        return null;
    }

    throw new SyntaxError('Value can not be normalized.');
}

/**
 * Decode one already-normalized wire token: the negation modifier
 * phase (G4) followed by the first-match row scan (G5). Raw rows
 * keep their inner text verbatim; coerced rows re-normalize it.
 * Total over strings — the eq row (empty markers) matches every
 * residual token.
 */
function decodeToken(input: string) : FilterWireCondition {
    let token = input;
    let negated = false;

    if (token.substring(0, FILTER_WIRE_NEGATION.length) === FILTER_WIRE_NEGATION) {
        token = token.substring(FILTER_WIRE_NEGATION.length);
        negated = true;
    }

    for (const [operator, spec] of ROWS) {
        if (
            token.substring(0, spec.prefix.length) !== spec.prefix ||
            token.substring(token.length - spec.suffix.length) !== spec.suffix
        ) {
            continue;
        }

        // Intentionally String.prototype.substring: its argument swap
        // decodes the degenerate token '~' as contains '~' — frozen
        // v1 wire behavior, pinned in the wire spec.
        const inner = token.substring(spec.prefix.length, token.length - spec.suffix.length);

        // G4: '!' binds only to rows with a complement twin in core's
        // semantics; elsewhere it is silently discarded ('!<5' → lt 5).
        const twin = negated ? COMPLEMENT_OF[operator] : undefined;

        return {
            operator: twin ?? operator,
            value: spec.value === 'raw' ? inner : normalizeFilterValue(inner),
        };
    }

    /* v8 ignore next 2 -- unreachable: the eq row matches every token. */
    throw new SyntaxError('Value can not be normalized.');
}

/**
 * Decode a complete simple-dialect wire value (string, number, or
 * qs-produced array) into the condition it expresses. Applies
 * value-shape normalization first (commas beat markers), then the
 * membership lifting (G3): an array decodes as in, lifted to nin
 * when its first element carries the negation modifier — later
 * elements are never marker-stripped. Never throws: unusable input
 * yields a failure verdict so the caller decides drop vs. throw.
 *
 * @param input
 */
export function decodeFilterWireValue(input: unknown) : FilterWireDecodeResult {
    let value : Scalar | Scalar[];

    try {
        value = normalizeFilterValue(input);
    } catch {
        return { success: false, code: FilterWireDecodeFailure.VALUE_INVALID };
    }

    let condition : FilterWireCondition;

    if (Array.isArray(value)) {
        // G3: membership is a value shape, not a marker.
        const [first, ...rest] = value;
        let lifted : FilterWireCondition | undefined;

        if (typeof first === 'string') {
            const parsed = decodeToken(first);
            if (parsed.operator === FilterFieldOperator.NOT_EQUAL) {
                lifted = {
                    operator: FilterFieldOperator.NOT_IN,
                    value: [parsed.value, ...rest],
                };
            }
        }

        condition = lifted ?? { operator: FilterFieldOperator.IN, value };
    } else if (typeof value !== 'string') {
        condition = { operator: FilterFieldOperator.EQUAL, value };
    } else {
        condition = decodeToken(value);
    }

    // The empty-value policy: a non-array condition value decoding
    // to the empty string ('', '!', '<=', '~~') expresses nothing —
    // previously a post-check inside SimpleFiltersParser.
    if (
        !Array.isArray(condition.value) &&
        typeof condition.value === 'string' &&
        condition.value.length === 0
    ) {
        return { success: false, code: FilterWireDecodeFailure.VALUE_EMPTY };
    }

    return { success: true, condition };
}

/**
 * Serialize a bare (marker-free) value to its wire text — the
 * inverse of value normalization modulo scalar type ('5' → 5).
 * Values whose wire form would decode to a different condition are
 * rejected: comma-containing strings (an EQ would decode as IN),
 * empty strings and empty arrays (the condition would be dropped).
 */
function serializeBareValue(input: unknown) : string {
    if (typeof input === 'string') {
        if (input.includes(',')) {
            throw AdapterError.featureUnsupported('filters:value:comma');
        }

        if (input.trim().length === 0) {
            throw AdapterError.featureUnsupported('filters:value:empty');
        }

        return input;
    }

    if (
        typeof input === 'undefined' ||
        input === null
    ) {
        return 'null';
    }

    if (typeof input === 'number') {
        return `${input}`;
    }

    if (typeof input === 'boolean') {
        return input ? 'true' : 'false';
    }

    if (Array.isArray(input)) {
        if (input.length === 0) {
            throw AdapterError.featureUnsupported('filters:value:empty');
        }

        return input
            .map((el) => serializeBareValue(el))
            .join(',');
    }

    throw AdapterError.featureUnsupported('filters:value:type');
}

/**
 * Raw-row (LIKE family) inner text travels verbatim — the decoder
 * applies no scalar coercion and no comma-splitting to it. Strings
 * pass through unchanged; everything else uses the scalar wire form.
 */
function serializeRawText(input: unknown) : string {
    if (typeof input === 'string') {
        if (input.length === 0) {
            // decodes to an empty match text, which the parser drops.
            throw AdapterError.featureUnsupported('filters:value:empty');
        }

        return input;
    }

    return serializeBareValue(input);
}

/**
 * Resolve the row (and negation flag) that spells an operator:
 * its own row, its complement's row behind the negation modifier,
 * or — for the membership shape (G3) — the equality row.
 */
function resolveEncodeRow(operator: string) : {
    spec: FilterWireMarkerSpec,
    negated: boolean,
} {
    const rows = FILTER_WIRE_SPEC as Record<string, FilterWireMarkerSpec | undefined>;

    const direct = rows[operator];
    if (direct) {
        return { spec: direct, negated: false };
    }

    const semantics = FILTER_OPERATOR_SEMANTICS[
        operator as keyof typeof FILTER_OPERATOR_SEMANTICS
    ] as { complementOf?: `${FilterFieldOperator}` } | undefined;
    if (semantics && semantics.complementOf) {
        const positive = rows[semantics.complementOf];
        if (positive) {
            return { spec: positive, negated: true };
        }
    }

    if (operator === FilterFieldOperator.IN) {
        return { spec: FILTER_WIRE_SPEC.eq, negated: false };
    }

    if (operator === FilterFieldOperator.NOT_IN) {
        return { spec: FILTER_WIRE_SPEC.eq, negated: true };
    }

    // regex, mod, size, exists, elemMatch — no simple-dialect wire
    // syntax; they would decode as plain equality.
    throw AdapterError.operatorUnsupported(operator);
}

/**
 * G6 — subset law, enforced pointwise: the grammar has no escaping,
 * so collisions are value-content-induced (an EQUAL on 'foo~' would
 * re-decode as STARTS_WITH 'foo'). Every emitted token is re-decoded
 * through the module's own decoder and must yield the operator it
 * came from — modulo the membership-singleton equivalence: a scalar
 * list decodes as eq/ne and is lifted to in/nin by the shape rule.
 */
function verifyRoundTrip(
    condition: FilterWireEncodeInput,
    wire: string,
) : string {
    const decoded = decodeFilterWireValue(wire);

    let matches = decoded.success &&
        decoded.condition.operator === condition.operator;

    if (!matches && decoded.success && condition.operator === FilterFieldOperator.IN) {
        matches = decoded.condition.operator === FilterFieldOperator.EQUAL;
    }

    if (!matches && decoded.success && condition.operator === FilterFieldOperator.NOT_IN) {
        matches = decoded.condition.operator === FilterFieldOperator.NOT_EQUAL;
    }

    if (!matches) {
        throw AdapterError.featureUnsupported(
            `filters:value:${condition.field ?? condition.operator}`,
        );
    }

    return wire;
}

/**
 * Encode a condition to its simple-dialect wire token. The subset
 * law is unconditional, so failures always throw typed errors:
 * AdapterError.operatorUnsupported for operators without a wire
 * spelling, AdapterError.featureUnsupported for inexpressible
 * values (commas, empties, marker collisions). `field` is optional
 * error-message context only — it never reaches the wire.
 *
 * @param condition
 */
export function encodeFilterWireValue(
    condition: FilterWireEncodeInput,
) : string {
    const target = resolveEncodeRow(condition.operator);

    const body = target.spec.value === 'raw' ?
        serializeRawText(condition.value) :
        serializeBareValue(condition.value);

    const wire = (target.negated ? FILTER_WIRE_NEGATION : '') +
        target.spec.prefix + body + target.spec.suffix;

    return verifyRoundTrip(condition, wire);
}
