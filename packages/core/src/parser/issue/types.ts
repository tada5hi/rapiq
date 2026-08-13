/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../../constants';
import type {
    IParseError,
    IParseErrorConstructor,
    Issue,
} from '../../errors';

/**
 * The failure a trace holds: the first issue recorded with `severity: 'error'`,
 * plus what the site that found it would have thrown.
 *
 * Everything an error is rebuilt FROM, and nothing about how — building it is
 * {@link buildErrorFromIssueCollector}'s job.
 */
export type IssueFailure = {
    issue: Issue,
    /**
     * The class the failing site named, when it is not simply its parameter's
     * (a scope may be built with an explicit override).
     */
    errorClass?: IParseErrorConstructor,
    /**
     * The error the failure was caught as, when it was one, so the rebuilt
     * error can keep the stack of the throw it came from.
     */
    cause?: IParseError,
};

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
     * Record a violation under the failure policy in effect where it was
     * found: a policy that throws makes the issue an `error` (and the parse
     * will end on it), a dropping policy a `warning`.
     */
    violation(
        input: Omit<Issue, 'severity'>,
        throwOnFailure?: boolean,
        errorClass?: IParseErrorConstructor,
    ) : void;

    /**
     * Record something the parse did to the input without rejecting it —
     * a clamped limit, substituted defaults. Never fails a parse.
     */
    notice(input: Omit<Issue, 'severity'>) : void;

    /**
     * Record a thrown parse error as the issue it never got to be.
     */
    error(input: IParseError, parameter: `${Parameter}`, path?: string[]) : void;

    record(
        input: Issue,
        errorClass?: IParseErrorConstructor,
        cause?: IParseError,
    ) : void;

    readonly issues : Issue[];

    /**
     * The failure this trace holds, or undefined when nothing was rejected
     * outright.
     */
    readonly failure : IssueFailure | undefined;

    readonly failed : boolean;
}
