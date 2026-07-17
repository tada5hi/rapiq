/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, IFilters } from '@rapiq/core';
import {
    AdapterError,
    FilterFieldOperator,
    ITSELF,
    isFilter,
    isFilters,
} from '@rapiq/core';
import {
    FILTER_EXPRESSION_KEYWORDS,
    FILTER_FIELD_SEGMENT_PATTERN,
} from '@rapiq/parser-expression';
import { parseFilterScalar } from '@rapiq/parser-simple';

/**
 * Grammar keywords of the expression dialect — a field segment
 * matching one of these would tokenize as an operator on decode.
 */
const KEYWORDS = new Set(Object.keys(FILTER_EXPRESSION_KEYWORDS));

/**
 * A field segment must survive the expression tokenizer unchanged.
 */
const FIELD_SEGMENT = new RegExp(`^(?:${FILTER_FIELD_SEGMENT_PATTERN})$`);

/**
 * Serialize a filters tree to its expression-dialect wire form,
 * e.g. and(eq(name,'John'),or(gte(age,'18'),eq(email,null))).
 * Nested compounds and elemMatch are first-class in this dialect;
 * only operators without a grammar production (REGEX, MOD, EXISTS)
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
        isFilter(input.value[0])
    ) {
        return serializeCondition(input.value[0], false);
    }

    return serializeCompound(input, false);
}

function serializeCompound(input: IFilters, insideElemMatch: boolean) : string {
    if (input.value.length === 0) {
        // an empty compound has no grammar production — and() is a
        // syntax error on decode.
        throw AdapterError.featureUnsupported('filters:compound:empty');
    }

    const children = input.value.map(
        (child) => serializeCondition(child, insideElemMatch),
    );

    return `${input.operator}(${children.join(',')})`;
}

function serializeCondition(node: ICondition, insideElemMatch: boolean) : string {
    if (isFilters(node)) {
        return serializeCompound(node, insideElemMatch);
    }

    if (!isFilter(node)) {
        throw AdapterError.featureUnsupported('filters:condition');
    }

    const field = serializeField(node.field, insideElemMatch);

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
        case FilterFieldOperator.ELEM_MATCH: {
            const interior = node.value as ICondition;
            if (!isFilter(interior) && !isFilters(interior)) {
                throw AdapterError.featureUnsupported('filters:elemMatch:value');
            }

            return `elemMatch(${field},${serializeCondition(interior, true)})`;
        }
        default: {
            // REGEX, MOD, EXISTS, ... have no expression grammar
            // production.
            throw AdapterError.operatorUnsupported(node.operator);
        }
    }
}

function serializeField(input: string, insideElemMatch: boolean) : string {
    // the ITSELF marker has a dedicated token — legal only inside an
    // elemMatch interior, where it references the array element.
    if (input === ITSELF) {
        if (!insideElemMatch) {
            throw AdapterError.featureUnsupported(`filters:field:${input}`);
        }

        return input;
    }

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
        // the decoder trims and type-coerces quoted content. Only a
        // pure type normalization ('5' → 5, 'true' → true) preserves
        // the condition's semantics; anything else must fail loudly:
        // ' John ' decodes trimmed, 'null' becomes an IS NULL check,
        // '0xFF' becomes the number 255.
        const decoded = parseFilterScalar(input);
        const roundTrips = typeof decoded === 'string' ?
            decoded === input :
            decoded !== null && `${decoded}` === input;
        if (!roundTrips) {
            throw AdapterError.featureUnsupported('filters:value:text');
        }

        return quote(input);
    }

    if (typeof input === 'number') {
        if (Number.isNaN(input)) {
            // 'NaN' fails Number() coercion on decode and would come
            // back as the string 'NaN'.
            throw AdapterError.featureUnsupported('filters:value:number');
        }

        // quoted; the decoder coerces the scalar type back.
        return quote(`${input}`);
    }

    if (typeof input === 'boolean') {
        return quote(`${input}`);
    }

    throw AdapterError.featureUnsupported('filters:value:type');
}

function quote(text: string) : string {
    return `'${text.replace(/'/g, '\'\'')}'`;
}

function serializeList(input: unknown) : string {
    const value = Array.isArray(input) ? input : [input];

    return value
        .map((element) => `,${serializeValue(element)}`)
        .join('');
}

/**
 * Match text (contains/startsWith/endsWith) must survive the
 * decoder's scalar coercion unchanged: staying a string (numeric-
 * or boolean-looking text would decode to a non-string) and keeping
 * its exact characters (surrounding whitespace decodes trimmed).
 */
function serializeMatchText(input: unknown) : string {
    const text = typeof input === 'string' ? input : `${input}`;

    if (parseFilterScalar(text) !== text) {
        throw AdapterError.featureUnsupported('filters:value:text');
    }

    return quote(text);
}
