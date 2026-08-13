/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../constants';
import type { ErrorCode } from './code';

/**
 * `error`: the input was rejected — under `throwOnFailure` the first issue of
 * this severity is the one the parse throws.
 *
 * `warning`: the input was dropped, clamped or defaulted without failing the
 * parse — the default policy, and what makes an otherwise silent discard
 * visible.
 */
export type IssueSeverity = 'error' | 'warning';

/**
 * One machine-readable trace of client input a parse rejected, dropped,
 * clamped or replaced.
 *
 * Plain data, never an `Error`: a single request may produce many, and only
 * the one error a parse ultimately throws pays for a stack. The shape follows
 * the issue-array convention (a `path` array, a stable `code`, the offending
 * `input`) that Zod, valibot and GraphQL settled on.
 */
export type Issue = {
    /**
     * Machine contract, shared with the thrown error's `code`.
     */
    code: `${ErrorCode}`,
    /**
     * The parameter that owns the policy the input violated. A relation path
     * rejected inside a `fields` key reports `fields`, matching the error
     * class that parameter throws.
     */
    parameter: `${Parameter}`,
    /**
     * Canonical (alias-resolved) position, leaf included: `['items', 'title']`
     * for `items.title`. Empty for a parameter-level issue.
     */
    path: string[],
    /**
     * The raw client key, before alias mapping — recorded when it differs
     * from the canonical path.
     */
    key?: string,
    /**
     * The offending value, echoed JSON-safe. Absent when the key itself,
     * not a value, was the problem.
     */
    input?: unknown,
    severity: IssueSeverity,
    /**
     * Human-facing text. NOT contractual: branch on `code`.
     */
    message: string,
};

/**
 * Upper bound of issues one parse records. Hostile input can violate a policy
 * once per key, and the trace is a diagnostic, not a transcript — the first
 * error decides what the parse throws, so a truncated tail changes nothing
 * about the outcome.
 */
export const MAX_ISSUES = 100;
