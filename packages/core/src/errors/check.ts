/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { matchesInstanceof } from '@ebec/core';
import type { IBaseError, IParseError } from './types';

/**
 * Cross-realm brands for the error hierarchy, mirroring `CONDITION_MARKER`.
 *
 * `instanceof` compares class identity, which two copies of `@rapiq/core` in
 * one process (mixed ESM/bundled builds, a dual-packaged dependency) do not
 * share. The failure mode is quiet and bad: a parse would rethrow a foreign
 * `ParseError` instead of recording it, and the trace would come back empty.
 *
 * `@ebec/core` owns the mechanism, which is the house standard and stronger
 * than one boolean per level: the markers form a CHAIN under one
 * non-enumerable `@instanceof` key, so a subclass is recognized as its
 * ancestors without marking itself twice, and the chain is serialized by
 * {@link BaseError.toJSON} — `matchesInstanceof` therefore also recognizes an
 * error that crossed a boundary as JSON and came back as a plain object.
 *
 * Only the brand utilities are borrowed. rapiq keeps its own `BaseError`,
 * interfaces and wire shape, and deliberately does NOT take ebec's error-group
 * mechanism (`errors: Error[]`): everything rapiq aggregates is a client-input
 * rejection, which is data, and lives in `issues`.
 */
export const BASE_ERROR_MARKER : unique symbol = Symbol.for('@rapiq/core/error');

export const PARSE_ERROR_MARKER : unique symbol = Symbol.for('@rapiq/core/error/parse');

/**
 * Whether the value is an error this library raised.
 *
 * Prefer it to `instanceof BaseError` on any boundary a foreign copy of the
 * library — or a serialized error — could reach.
 */
export function isBaseError(input: unknown) : input is IBaseError {
    return matchesInstanceof(input, BASE_ERROR_MARKER);
}

/**
 * Whether the value is a client-input failure.
 */
export function isParseError(input: unknown) : input is IParseError {
    return matchesInstanceof(input, PARSE_ERROR_MARKER);
}
