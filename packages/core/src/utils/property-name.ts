/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function isPropertyNameValid(input: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/gu.test(input);
}

/**
 * Names a call identifier (a group column, a function name, a slot
 * column) must not take: each becomes a row or record key, where these
 * three reach the prototype instead of an own property.
 */
const CALL_IDENTIFIER_RESERVED = ['__proto__', 'constructor', 'prototype'];

/**
 * A valid property name that is not reserved, for groups and
 * aggregates identifiers only. Other parameters keep
 * {@link isPropertyNameValid}.
 */
export function isCallIdentifierValid(input: string): boolean {
    return isPropertyNameValid(input) && !CALL_IDENTIFIER_RESERVED.includes(input);
}
