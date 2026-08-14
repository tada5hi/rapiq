/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../../constants';
import type { ErrorCode } from '../code';

/**
 * What every issue carries, leaf or group.
 *
 * Plain data, never an `Error`: a single request may produce many, and only
 * the one error a parse ultimately throws pays for a stack.
 */
export type IssueBase = {
    /**
     * Canonical (alias-resolved) position, leaf included: `['items', 'title']`
     * for `items.title`. Empty for a parameter-level issue.
     *
     * ABSOLUTE on every node, group included: a site reports the position it
     * knows, and whoever merges the result into an enclosing trace rewrites
     * the children through {@link prefixIssuePath}.
     */
    path: string[],
    /**
     * Human-facing text. NOT contractual: branch on `code`.
     */
    message: string,
    /**
     * The parameter that owns the policy the input violated. A relation path
     * rejected inside a `fields` key reports `fields`, matching the error
     * class that parameter throws. Absent on an issue no single parameter
     * owns.
     */
    parameter?: `${Parameter}`,
};

/**
 * One rejected piece of client input.
 *
 * There is no other kind: an issue is always a failure. A dropping policy
 * records nothing at all — the key is dropped, nothing will be raised, and a
 * trace nobody can read is a trace nobody should pay for.
 */
export type IssueItem = IssueBase & {
    type: 'item',
    /**
     * Machine contract, shared with the thrown error's `code`.
     */
    code: `${ErrorCode}`,
    /**
     * The raw client key, before alias mapping — recorded when it differs
     * from the canonical path.
     */
    key?: string,
    /**
     * The offending value, echoed as received. Absent when the key itself,
     * not a value, was the problem.
     */
    input?: unknown,
};

/**
 * A failure standing for the ones below it — a parameter that aborted, a
 * nested parse merged into an enclosing one.
 *
 * Nesting IS the tree: no parent pointer, no depth field.
 */
export type IssueGroup = IssueBase & {
    type: 'group',
    code?: `${ErrorCode}`,
    issues: Issue[],
};

/**
 * One machine-readable trace entry of client input a parse rejected.
 *
 * The shape follows the issue-tree convention validup defines and authup
 * consumes, so a trace crosses library boundaries unchanged.
 */
export type Issue = IssueItem | IssueGroup;
