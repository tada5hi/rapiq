/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, IFilters } from '@rapiq/core';
import {
    AdapterError,
    Filter,
    FilterFieldOperator,
    Filters,
} from '@rapiq/core';
import { parseFilterScalar } from '@rapiq/parser-simple';

/**
 * Grammar keywords of the expression dialect — a field segment
 * matching one of these would tokenize as an operator on decode.
 */
const KEYWORDS = new Set([
    'not', 
    'and', 
    'or',
    'eq', 
    'gt', 
    'gte', 
    'lt', 
    'lte',
    'contains', 
    'startsWith', 
    'endsWith',
    'in', 
    'nin', 
    'null',
]);

/**
 * A field segment must survive the expression tokenizer unchanged.
 */
const FIELD_SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/;

/**
 * Serialize a filters tree to its expression-dialect wire form,
 * e.g. and(eq(name,'John'),or(gte(age,'18'),eq(email,null))).
 * Nested compounds are first-class in this dialect; only operators
 * without a grammar production (REGEX, MOD, EXISTS, ELEM_MATCH)
 * and non-wire-safe names/values are rejected.
 *
 * Returns null for an empty root (nothing to emit).
 */
export function serializeFiltersExpression(input: IFilters) : string | null {
    if (input.value.length === 0) {
        return null;
    }

    // a single root condition needs no compound wrapper — the parser
    // wraps bare conditions back into a root AND.
    if (
        input.value.length === 1 &&
        input.value[0] instanceof Filter
    ) {
        return serializeCondition(input.value[0]);
    }

    return serializeCompound(input);
}

function serializeCompound(input: IFilters) : string {
    if (input.value.length === 0) {
        // an empty compound has no grammar production — and() is a
        // syntax error on decode.
        throw AdapterError.featureUnsupported('filters:compound:empty');
    }

    const children = input.value.map(
        (child) => serializeCondition(child),
    );

    return `${input.operator}(${children.join(',')})`;
}

function serializeCondition(node: ICondition) : string {
    if (node instanceof Filters) {
        return serializeCompound(node);
    }

    if (!(node instanceof Filter)) {
        throw AdapterError.featureUnsupported('filters:condition');
    }

    const field = serializeField(node.field);

    switch (node.operator) {
        case FilterFieldOperator.EQUAL: {
            return `eq(${field},${serializeValue(node.value)})`;
        }
        case FilterFieldOperator.NOT_EQUAL: {
            return `not(eq(${field},${serializeValue(node.value)}))`;
        }
        case FilterFieldOperator.LESS_THAN: {
            return `lt(${field},${serializeValue(node.value)})`;
        }
        case FilterFieldOperator.LESS_THAN_EQUAL: {
            return `lte(${field},${serializeValue(node.value)})`;
        }
        case FilterFieldOperator.GREATER_THAN: {
            return `gt(${field},${serializeValue(node.value)})`;
        }
        case FilterFieldOperator.GREATER_THAN_EQUAL: {
            return `gte(${field},${serializeValue(node.value)})`;
        }
        case FilterFieldOperator.IN: {
            return `in(${field}${serializeList(node.value)})`;
        }
        case FilterFieldOperator.NOT_IN: {
            return `nin(${field}${serializeList(node.value)})`;
        }
        case FilterFieldOperator.CONTAINS: {
            return `contains(${field},${serializeMatchText(node.value)})`;
        }
        case FilterFieldOperator.NOT_CONTAINS: {
            return `not(contains(${field},${serializeMatchText(node.value)}))`;
        }
        case FilterFieldOperator.STARTS_WITH: {
            return `startsWith(${field},${serializeMatchText(node.value)})`;
        }
        case FilterFieldOperator.NOT_STARTS_WITH: {
            return `not(startsWith(${field},${serializeMatchText(node.value)}))`;
        }
        case FilterFieldOperator.ENDS_WITH: {
            return `endsWith(${field},${serializeMatchText(node.value)})`;
        }
        case FilterFieldOperator.NOT_ENDS_WITH: {
            return `not(endsWith(${field},${serializeMatchText(node.value)}))`;
        }
        default: {
            // REGEX, MOD, EXISTS, ELEM_MATCH, ... have no expression
            // grammar production.
            throw AdapterError.operatorUnsupported(node.operator);
        }
    }
}

function serializeField(input: string) : string {
    const segments = input.split('.');

    for (const segment of segments) {
        if (
            !FIELD_SEGMENT.test(segment) ||
            KEYWORDS.has(segment)
        ) {
            throw AdapterError.featureUnsupported(`filters:field:${input}`);
        }
    }

    return input;
}

function serializeValue(input: unknown) : string {
    if (
        typeof input === 'undefined' ||
        input === null
    ) {
        return 'null';
    }

    if (typeof input === 'string') {
        return `'${input.replace(/'/g, '\'\'')}'`;
    }

    if (
        typeof input === 'number' ||
        typeof input === 'boolean'
    ) {
        // quoted; the decoder coerces the scalar type back.
        return `'${input}'`;
    }

    throw AdapterError.featureUnsupported('filters:value:type');
}

function serializeList(input: unknown) : string {
    const value = Array.isArray(input) ? input : [input];

    return value
        .map((element) => `,${serializeValue(element)}`)
        .join('');
}

/**
 * Match text (contains/startsWith/endsWith) must stay a string
 * after the decoder's scalar coercion — numeric- or boolean-looking
 * text ('5', 'true') would decode to a non-string and fail there.
 */
function serializeMatchText(input: unknown) : string {
    const text = typeof input === 'string' ? input : `${input}`;

    if (typeof parseFilterScalar(text) !== 'string') {
        throw AdapterError.featureUnsupported('filters:value:text');
    }

    return serializeValue(text);
}
