/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../types';
import { isObject } from '../utils';
import type { IBaseError, IParseError } from './types';

/**
 * Cross-realm brands for the error hierarchy, mirroring `CONDITION_MARKER`.
 *
 * `instanceof` compares class identity, which two copies of `@rapiq/core` in
 * one process (mixed ESM/bundled builds, a dual-packaged dependency) do not
 * share. The failure mode is quiet and bad: a parse would rethrow a foreign
 * `ParseError` instead of recording it, and the trace would come back empty.
 * A `Symbol.for` brand survives the duplication, because the global symbol
 * registry is per process rather than per module instance.
 */
export const BASE_ERROR_MARKER : unique symbol = Symbol.for('@rapiq/core/error');

export const PARSE_ERROR_MARKER : unique symbol = Symbol.for('@rapiq/core/error/parse');

/**
 * Brand an error, invisibly: an error's enumerable shape is what deep equality
 * and `JSON.stringify` see, and identity is not part of what it reports.
 */
export function markError(input: ObjectLiteral, marker: symbol) : void {
    Object.defineProperty(input, marker, {
        value: true,
        enumerable: false,
        writable: false,
        configurable: true,
    });
}

function isMarked(input: unknown, marker: symbol) : boolean {
    if (!isObject(input)) {
        return false;
    }

    // the brand is asserted, not merely present, exactly like isCondition
    return (input as Record<symbol, unknown>)[marker] === true;
}

/**
 * Whether the value is an error this library raised.
 *
 * Prefer it to `instanceof BaseError` on any boundary a foreign copy of the
 * library could reach.
 */
export function isBaseError(input: unknown) : input is IBaseError {
    return isMarked(input, BASE_ERROR_MARKER);
}

/**
 * Whether the value is a client-input failure.
 */
export function isParseError(input: unknown) : input is IParseError {
    return isMarked(input, PARSE_ERROR_MARKER);
}
