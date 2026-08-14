/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Issue } from 'blemish';
import type { Parameter } from '../../constants';
import type { IParseError, IssueInput } from '../../errors';

/**
 * The trace of one parse call: it collects what its sites record and serves
 * it back. It does not raise, and it does not build errors — a trace is
 * evidence, and deciding what to throw from it belongs to the caller that
 * owns the parse.
 *
 * Referenced instead of the class wherever a trace is threaded, so a parser
 * that wants to observe or wrap the recording can supply its own.
 */
export interface IIssueCollector {
    /**
     * Add a rejection, under the failure policy in effect where it was found.
     * A policy that drops adds nothing.
     */
    add(input: IssueInput, throwOnFailure?: boolean) : void;

    /**
     * Record a thrown parse error as the issue it never got to be, or its
     * whole trace when it carries one.
     */
    addError(input: IParseError, parameter?: `${Parameter}`, path?: string[]) : void;

    /**
     * Take over the issues of a nested trace, rebased onto the position it
     * was merged at.
     */
    merge(issues: readonly Issue[], path?: string[]) : void;

    readonly issues : Issue[];

    readonly failed : boolean;
}
