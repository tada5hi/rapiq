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
 * The trace of one parse call: what its sites recorded, and the failure it
 * owes its caller.
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

    readonly failed : boolean;

    /**
     * The error this trace owes its caller, or undefined when nothing was
     * rejected outright.
     */
    toError() : IParseError | undefined;

    throwIfFailed() : void;
}
