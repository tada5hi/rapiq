/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../../constants';
import type { ErrorCode } from '../code';

/**
 * The `meta` keys rapiq claims on an issue it produces.
 *
 * Both meet blemish's bar for the field — provenance a consumer cannot
 * reconstruct from `path` — and neither is a rendering decision:
 *
 * - a `fields` rejection and a `filters` rejection at `['items', 'secret']`
 *   are indistinguishable by path, and which parameter's policy refused the
 *   input is what selects the wire name a response reports it under;
 * - `path` is alias-resolved, so the spelling the client actually sent is
 *   gone from it.
 */
export type IssueMeta = {
    /**
     * The parameter that owns the policy the input violated. A relation path
     * rejected inside a `fields` key reports `fields`, matching the error
     * class that parameter throws.
     */
    parameter?: `${Parameter}`,
    /**
     * The raw client key, before alias mapping — recorded when it differs
     * from the canonical path.
     */
    key?: string,
};

/**
 * What a rapiq site reports when it rejects client input.
 *
 * The stored node is blemish's; this is the shape its producers speak, so a
 * recording site names `parameter` under type control rather than assembling
 * an untyped `meta` bag itself.
 */
export type IssueInput = IssueMeta & {
    /**
     * Machine contract, shared with the thrown error's `code`.
     */
    code: `${ErrorCode}`,
    /**
     * Canonical (alias-resolved) position, leaf included: `['items', 'title']`
     * for `items.title`. Empty for a parameter-level issue.
     */
    path: string[],
    /**
     * Human-facing text. NOT contractual: branch on `code`.
     */
    message: string,
    /**
     * The offending value, echoed as received. Absent when the key itself,
     * not a value, was the problem.
     */
    received?: unknown,
};
