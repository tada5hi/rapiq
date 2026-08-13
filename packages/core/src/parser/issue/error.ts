/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IParseError } from '../../errors';
import { PARAMETER_ERROR_CLASSES } from './constants';
import type { IIssueCollector } from './types';

/**
 * Rebuild the error a trace's failure stands for, or undefined when nothing
 * was rejected outright.
 *
 * The rebuilt error is indistinguishable from the one the fail-fast path threw
 * before aggregation existed — same class, same `code`, same message — so
 * first-issue-wins holds by construction. It carries the whole trace as
 * `issues`, and the throw it was caught as (when it was one) as `cause`.
 *
 * Deliberately not a method on the collector: collecting evidence and deciding
 * what to raise from it are separate jobs, and only the call that owns the
 * parse is in a position to do the second.
 */
export function buildIssueError(input: IIssueCollector) : IParseError | undefined {
    const { failure } = input;
    if (!failure) {
        return undefined;
    }

    const ErrorClass = failure.errorClass ??
        PARAMETER_ERROR_CLASSES[failure.issue.parameter];

    return new ErrorClass({
        code: failure.issue.code,
        message: failure.issue.message,
        issues: input.issues,
        cause: failure.cause,
    });
}

/**
 * Raise what a trace collected, if anything was rejected outright.
 */
export function raiseIssueError(input: IIssueCollector) : void {
    const error = buildIssueError(input);
    if (error) {
        throw error;
    }
}
