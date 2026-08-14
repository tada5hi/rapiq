/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { prefixIssuePath } from 'blemish';
import type { Issue } from 'blemish';
import type { Parameter } from '../../constants';
import { MAX_ISSUES, buildIssue } from '../../errors';
import type { IParseError, IssueInput } from '../../errors';
import type { IIssueCollector } from './types';

/**
 * The trace of one parse call: every issue its sites recorded, and which of
 * them the parse failed on.
 *
 * A collector inverts the failure policy. Instead of throwing where a
 * violation is found, a site records it and takes the drop path, so a request
 * with several bad keys reports all of them. What to do about that is not its
 * decision: it collects and serves, and the call that owns the parse raises
 * the failure (`BaseParser.finishIssues`).
 *
 * Every issue is a failure. Under a dropping policy nothing is recorded at
 * all: the key is dropped, nothing will be raised, and a trace nobody can read
 * is a trace nobody should pay for.
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

    protected caught : IParseError | undefined;

    constructor() {
        this.items = [];
    }

    // -----------------------------------------------------

    /**
     * Record a violation under the failure policy in effect where it was
     * found. A policy that drops records nothing — there is no failure to
     * raise, so there is nobody to read it.
     */
    violation(input: IssueInput, throwOnFailure?: boolean) : void {
        if (!throwOnFailure) {
            return;
        }

        this.record(buildIssue(input));
    }

    /**
     * Record a thrown parse error as the issue it never got to be: the
     * structural failures (a malformed expression, an input of the wrong
     * shape) abort their parameter instead of dropping one key, so the
     * caller catches them here. The error is kept as the trace's {@link cause}
     * so its stack survives, but it is not what the parse raises: it describes
     * one parameter, and the parse may have rejected input in four others.
     *
     * A throw that already carries a trace hands over that trace rather than
     * a summary of it: the positions its sites recorded are the ones no
     * enclosing site could reconstruct.
     */
    error(input: IParseError, parameter: `${Parameter}`, path: string[] = []) : void {
        const issues = input.issues ?? [];
        if (issues.length > 0) {
            this.merge(issues, path, input);

            return;
        }

        this.record(buildIssue({
            code: input.code,
            parameter,
            path,
            message: input.message,
        }), input);
    }

    /**
     * Take over the issues of a nested trace, rebased onto the position it
     * was merged at.
     */
    merge(issues: readonly Issue[], path: string[] = [], cause?: IParseError) : void {
        for (const issue of issues) {
            this.record(prefixIssuePath(issue, path), cause);
        }
    }

    record(input: Issue, cause?: IParseError) : void {
        if (cause && !this.caught) {
            this.caught = cause;
        }

        // The tail of a hostile request changes nothing about the outcome: the
        // trace is a diagnostic, and what the parse raises does not depend on
        // which issue came first.
        if (this.items.length >= MAX_ISSUES) {
            return;
        }

        this.items.push(input);
    }

    // -----------------------------------------------------

    get issues() : Issue[] {
        return this.items;
    }

    /**
     * The throw a structural abort was caught as, when one was: kept so the
     * raised failure can point at it, never so it can BE it.
     */
    get cause() : IParseError | undefined {
        return this.caught;
    }

    get failed() : boolean {
        return this.items.length > 0;
    }
}
