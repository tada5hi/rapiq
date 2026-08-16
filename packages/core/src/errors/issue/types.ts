/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../../constants';
import type { ErrorCodeInput } from '../types';

/**
 * What a rapiq site reports when it rejects client input.
 *
 * The stored node is blemish's; this is the shape its producers speak, so a
 * recording site names `parameter` under type control rather than assembling
 * an untyped `meta` bag itself.
 *
 * `parameter` and `key` become blemish `meta` keys. Both meet its documented
 * bar for that field (provenance a consumer cannot reconstruct from `path`),
 * and neither is a rendering decision: a `fields` rejection and a `filters`
 * rejection at `['items', 'secret']` are indistinguishable by path, and the
 * path is alias-resolved, so the spelling the client sent is gone from it.
 */
export type IssueInput = {
    /**
     * The parameter that owns the policy the input violated. A relation path
     * rejected inside a `fields` key reports `fields`, matching the error
     * class that parameter throws.
     */
    parameter?: `${Parameter}`,
    /**
     * The raw client key, before alias mapping, recorded when it differs
     * from the canonical path.
     */
    key?: string,

    /**
     * Machine contract, shared with the thrown error's `code`.
     */
    code: ErrorCodeInput,
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
