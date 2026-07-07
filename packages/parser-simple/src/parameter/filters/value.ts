/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, FilterFieldOperator } from '@rapiq/core';
import type { Scalar } from '@rapiq/core';
import { URLFilterOperator } from './constants';

/**
 * Coerce a wire string to its typed scalar form:
 * 'true'/'false' → boolean, 'null' → null, numeric → number,
 * anything else → trimmed string. The comma-split array
 * convention is NOT applied here — this is the pure scalar
 * normalization shared by the simple & expression dialects.
 *
 * @param input
 */
export function parseFilterScalar(input: string) : Scalar {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
        return trimmed;
    }

    const lower = trimmed.toLowerCase();

    if (lower === 'true') {
        return true;
    }

    if (lower === 'false') {
        return false;
    }

    if (lower === 'null') {
        return null;
    }

    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
        return num;
    }

    return trimmed;
}

/**
 * Parse a simple-dialect wire value: scalar coercion plus the
 * comma-split array convention and array flattening.
 *
 * @param input
 */
export function parseFilterValue(input: unknown) : Scalar | Scalar[] {
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.length === 0) {
            return trimmed;
        }

        const parts = trimmed.split(',');
        if (parts.length > 1) {
            return parseFilterValue(parts);
        }

        return parseFilterScalar(trimmed);
    }

    if (typeof input === 'number') {
        return input;
    }

    if (Array.isArray(input)) {
        const output : Scalar[] = [];

        for (const element of input) {
            const temp = parseFilterValue(element);
            if (Array.isArray(temp)) {
                output.push(...temp);
            } else {
                output.push(temp);
            }
        }

        return output
            .filter((n) => n === 0 || n === null || !!n);
    }

    if (typeof input === 'undefined' || input === null) {
        return null;
    }

    throw new SyntaxError('Value can not be normalized.');
}

/**
 * Parse a single already-normalized wire token (operator markers +
 * value): leading '!' (negation), '~'-style LIKE markers and
 * comparison prefixes ('<', '<=', '>', '>='). LIKE inner text stays
 * a raw string; all other values pass through {@link parseFilterValue}.
 */
function parseFilterWireToken(input: string) : {
    operator: `${FilterFieldOperator}`,
    value: unknown
} {
    let value = input;
    let hasNegation = false;

    if (
        value.substring(0, 1) === URLFilterOperator.NEGATION
    ) {
        value = value.substring(1);
        hasNegation = true;
    }

    const hasLikeStart = value.substring(0, URLFilterOperator.LIKE.length) === URLFilterOperator.LIKE;
    const hasLikeEnd = value.substring(value.length - URLFilterOperator.LIKE.length) === URLFilterOperator.LIKE;

    if (hasLikeStart && hasLikeEnd) {
        return {
            value: value.substring(URLFilterOperator.LIKE.length, value.length - URLFilterOperator.LIKE.length),
            operator: hasNegation ?
                FilterFieldOperator.NOT_CONTAINS :
                FilterFieldOperator.CONTAINS,
        };
    }

    if (hasLikeStart) {
        return {
            value: value.substring(URLFilterOperator.LIKE.length),
            operator: hasNegation ?
                FilterFieldOperator.NOT_ENDS_WITH :
                FilterFieldOperator.ENDS_WITH,
        };
    }

    if (hasLikeEnd) {
        return {
            value: value.substring(0, value.length - URLFilterOperator.LIKE.length),
            operator: hasNegation ?
                FilterFieldOperator.NOT_STARTS_WITH :
                FilterFieldOperator.STARTS_WITH,
        };
    }

    if (
        value.substring(0, URLFilterOperator.LESS_THAN_EQUAL.length) === URLFilterOperator.LESS_THAN_EQUAL
    ) {
        return {
            value: parseFilterValue(value.substring(URLFilterOperator.LESS_THAN_EQUAL.length)),
            operator: FilterFieldOperator.LESS_THAN_EQUAL,
        };
    }

    if (
        value.substring(0, URLFilterOperator.LESS_THAN.length) === URLFilterOperator.LESS_THAN
    ) {
        return {
            value: parseFilterValue(value.substring(URLFilterOperator.LESS_THAN.length)),
            operator: FilterFieldOperator.LESS_THAN,
        };
    }

    if (
        value.substring(0, URLFilterOperator.GREATER_THAN_EQUAL.length) === URLFilterOperator.GREATER_THAN_EQUAL
    ) {
        return {
            value: parseFilterValue(value.substring(URLFilterOperator.GREATER_THAN_EQUAL.length)),
            operator: FilterFieldOperator.GREATER_THAN_EQUAL,
        };
    }

    if (
        value.substring(0, URLFilterOperator.GREATER_THAN.length) === URLFilterOperator.GREATER_THAN
    ) {
        return {
            value: parseFilterValue(value.substring(URLFilterOperator.GREATER_THAN.length)),
            operator: FilterFieldOperator.GREATER_THAN,
        };
    }

    return {
        value: parseFilterValue(value),
        operator: hasNegation ?
            FilterFieldOperator.NOT_EQUAL :
            FilterFieldOperator.EQUAL,
    };
}

/**
 * Decode a complete simple-dialect wire value to its operator and
 * typed value: {@link parseFilterValue} normalization first (scalar
 * coercion, comma-split), then a comma-split (or already-array) value
 * becomes IN — lifted to NOT_IN when its first element is negated —
 * and a remaining string is parsed for operator markers.
 *
 * Throws a SyntaxError when the value can not be normalized.
 *
 * @param input
 */
export function parseFilterWireValue(input: unknown) : {
    operator: `${FilterFieldOperator}`,
    value: unknown
} {
    const value = parseFilterValue(input);

    if (Array.isArray(value)) {
        const [first, ...rest] = value;
        if (typeof first === 'string') {
            const parsed = parseFilterWireToken(first);
            if (parsed.operator === FilterFieldOperator.NOT_EQUAL) {
                return {
                    value: [parsed.value, ...rest],
                    operator: FilterFieldOperator.NOT_IN,
                };
            }
        }

        return { value, operator: FilterFieldOperator.IN };
    }

    if (typeof value !== 'string') {
        return { value, operator: FilterFieldOperator.EQUAL };
    }

    return parseFilterWireToken(value);
}

/**
 * Serialize a typed filter value to its simple-dialect wire form —
 * the inverse of {@link parseFilterValue} modulo scalar type
 * normalization ('5' → 5, 'true' → true, surrounding whitespace).
 *
 * Values whose wire form would decode to a *different condition*
 * are rejected with a typed error instead of being emitted:
 * comma-containing strings (an EQ would decode as IN), empty
 * strings and empty arrays (the condition would be dropped).
 *
 * @param input
 */
export function serializeFilterValue(input: unknown) : string {
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
            .map((el) => serializeFilterValue(el))
            .join(',');
    }

    throw AdapterError.featureUnsupported('filters:value:type');
}
