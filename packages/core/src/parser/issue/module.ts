/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    flattenIssueItems,
    isIssueGroup,
    prefixIssuePath,
} from 'blemish';
import type { Issue } from 'blemish';
import type { Parameter } from '../../constants';
import { MAX_ISSUES, buildIssue } from '../../errors';
import type { IParseError, IssueInput } from '../../errors';
import type { IIssueCollector } from './types';

type IssueBudget = {
    remaining: number;
};

function trimIssueToLeafBudget(input: Issue, budget: IssueBudget) : Issue | undefined {
    if (budget.remaining <= 0) {
        return undefined;
    }

    if (!isIssueGroup(input)) {
        budget.remaining--;

        return input;
    }

    const issues : Issue[] = [];
    for (const child of input.issues) {
        if (budget.remaining === 0) {
            break;
        }

        const retained = trimIssueToLeafBudget(child, budget);
        if (retained) {
            issues.push(retained);
        }
    }

    return issues.length > 0 ? { ...input, issues } : undefined;
}

function removeLastIssueItem(issues: Issue[]) : boolean {
    for (let index = issues.length - 1; index >= 0; index--) {
        const issue = issues[index]!;
        if (!isIssueGroup(issue)) {
            issues.splice(index, 1);

            return true;
        }

        if (removeLastIssueItem(issue.issues)) {
            if (issue.issues.length === 0) {
                issues.splice(index, 1);
            }

            return true;
        }
    }

    return false;
}

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

    protected leafCount : number;

    constructor() {
        this.items = [];
        this.leafCount = 0;
    }

    // -----------------------------------------------------

    /**
     * Add a rejection.
     *
     * Whether one is added at all is the caller's decision, made where the
     * failure policy is known: a dropping policy adds nothing, because there
     * is no failure to raise and so nobody to read it. The trace does not
     * second-guess that — it would mean building an issue in order to bin it,
     * and a collector that filters is a collector with an opinion.
     */
    add(input: IssueInput) : void {
        this.record(buildIssue(input));
    }

    /**
     * Record a thrown parse error as the issue it never got to be: the
     * structural failures (a malformed expression, an input of the wrong
     * shape) abort their parameter instead of dropping one key, so the
     * caller catches them here. The error OBJECT is not kept: only branded
     * parse errors are ever recorded (a server bug propagates untouched), and
     * everything a client-input failure knows is in the issue it becomes.
     *
     * A throw that already carries a trace hands over that trace rather than
     * a summary of it: the positions its sites recorded are the ones no
     * enclosing site could reconstruct.
     */
    addError(input: IParseError, parameter?: `${Parameter}`, path: string[] = []) : void {
        this.synchronizeLeafCount();

        const issues = input.issues ?? [];
        if (issues.length > 0) {
            const before = this.leafCount;
            this.merge(issues, path);
            if (this.leafCount > before) {
                return;
            }

            const first = flattenIssueItems([...issues])[0];
            if (first && this.record(prefixIssuePath(first, path), true)) {
                return;
            }
        }

        this.record(buildIssue({
            code: input.code,
            parameter,
            path,
            message: input.message,
        }), true);
    }

    /**
     * Take over the issues of a nested trace, rebased onto the position it
     * was merged at.
     */
    merge(issues: readonly Issue[], path: string[] = []) : void {
        for (const issue of issues) {
            this.record(prefixIssuePath(issue, path));
        }
    }

    protected synchronizeLeafCount() : void {
        this.leafCount = flattenIssueItems(this.items).length;
    }

    protected record(input: Issue, priority = false) : boolean {
        this.synchronizeLeafCount();

        // The tail of a hostile request changes nothing about the outcome: the
        // trace is a diagnostic, and what the parse raises does not depend on
        // which issue came first.
        if (priority && this.leafCount >= MAX_ISSUES) {
            if (removeLastIssueItem(this.items)) {
                this.leafCount--;
            }
        }

        const budget = { remaining: MAX_ISSUES - this.leafCount };
        const retained = trimIssueToLeafBudget(input, budget);
        if (!retained) {
            return false;
        }

        this.items.push(retained);
        this.leafCount += flattenIssueItems([retained]).length;

        return true;
    }

    // -----------------------------------------------------

    get issues() : Issue[] {
        return this.items;
    }

    get failed() : boolean {
        return this.items.length > 0;
    }
}
