/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, ParseError, attachIssues } from '../../errors';
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
export function buildErrorFromIssueCollector(input: IIssueCollector) : IParseError | undefined {
    const { failure } = input;
    if (!failure) {
        return undefined;
    }

    // An error the parse CAUGHT is re-raised as itself, with the trace
    // attached. Rebuilding it would mean calling a constructor nobody checked:
    // `code`, `message` and the trace all come from `BaseErrorOptions`, and a
    // consumer's error class is free to take something else entirely — an
    // app-defined `TenantParseError(field)` would be rebuilt with the options
    // object as its field, and a class with a bespoke options shape would
    // throw a TypeError out of the rebuild. Reuse also keeps the stack and the
    // brand, which a rebuild silently drops.
    if (failure.cause) {
        attachIssues(failure.cause, input.issues);

        return failure.cause;
    }

    // an issue no parameter owns is nobody's dialect error: it is raised as
    // the base class rather than through one parameter's, chosen at random.
    const ErrorClass = failure.errorClass ??
        (failure.issue.parameter ?
            PARAMETER_ERROR_CLASSES[failure.issue.parameter] :
            ParseError);

    return new ErrorClass({
        code: failure.issue.code ?? ErrorCode.NONE,
        message: failure.issue.message,
        issues: input.issues,
    });
}

/**
 * Raise what a trace collected, if anything was rejected outright.
 */
export function raiseErrorFromIssueCollector(input: IIssueCollector) : void {
    const error = buildErrorFromIssueCollector(input);
    if (error) {
        throw error;
    }
}
