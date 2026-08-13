/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../../constants';
import { MAX_ISSUES } from '../../errors';
import type { IParseError, IParseErrorConstructor, Issue } from '../../errors';
import { normalizeParameter } from '../../utils';
import type { IIssueCollector, IssueFailure } from './types';

/**
 * The trace of one parse call: every issue its sites recorded, and which of
 * them the parse failed on.
 *
 * A collector inverts the failure policy. Instead of throwing where a
 * violation is found, a site records it and takes the drop path, so a request
 * with several bad keys reports all of them. What to do about that is not its
 * decision: it collects and serves, and the call that owns the parse raises
 * the failure through {@link buildIssueError}.
 *
 * The trace is not observable anywhere else: a parse that raises nothing
 * discards it. `error.issues` is the single channel.
 *
 * A site without a collector keeps throwing immediately: `ResolutionScope` is
 * public API and usable outside a parse, where nobody would ever raise the
 * trace.
 */
export class IssueCollector implements IIssueCollector {
    protected items : Issue[];

    protected first : IssueFailure | undefined;

    constructor() {
        this.items = [];
    }

    // -----------------------------------------------------

    /**
     * Record a violation under the failure policy in effect where it was
     * found: a policy that throws makes the issue an `error` (and the parse
     * will end on it), a dropping policy a `warning`.
     */
    violation(
        input: Omit<Issue, 'severity'>,
        throwOnFailure?: boolean,
        errorClass?: IParseErrorConstructor,
    ) : void {
        this.record({
            ...input,
            severity: throwOnFailure ? 'error' : 'warning',
        }, errorClass);
    }

    /**
     * Record something the parse did to the input without rejecting it —
     * a clamped limit, substituted defaults. Never fails a parse.
     */
    notice(input: Omit<Issue, 'severity'>) : void {
        this.record({ ...input, severity: 'warning' });
    }

    /**
     * Record a thrown parse error as the issue it never got to be: the
     * structural failures (a malformed expression, an input of the wrong
     * shape) abort their parameter instead of dropping one key, so the
     * caller catches them here.
     */
    error(input: IParseError, parameter: `${Parameter}`, path: string[] = []) : void {
        this.record({
            code: input.code,
            parameter,
            path,
            severity: 'error',
            message: input.message,
        }, input.constructor as IParseErrorConstructor, input);
    }

    record(
        input: Issue,
        errorClass?: IParseErrorConstructor,
        cause?: IParseError,
    ) : void {
        const issue : Issue = {
            ...input,
            parameter: normalizeParameter(input.parameter) as `${Parameter}`,
        };

        const isFailure = !this.first && issue.severity === 'error';
        if (isFailure) {
            this.first = {
                issue, 
                errorClass, 
                cause, 
            };
        }

        // The tail of a hostile request changes nothing about the outcome: the
        // failure is already pinned, and the trace is a diagnostic. The issue
        // the parse FAILS on is exempt — an error whose own issue the cap
        // evicted would hand a consumer a 400 with nothing in it.
        if (this.items.length >= MAX_ISSUES && !isFailure) {
            return;
        }

        this.items.push(issue);
    }

    // -----------------------------------------------------

    get issues() : Issue[] {
        return this.items;
    }

    get failure() : IssueFailure | undefined {
        return this.first;
    }

    get failed() : boolean {
        return typeof this.first !== 'undefined';
    }
}
