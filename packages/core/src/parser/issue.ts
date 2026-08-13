/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../constants';
import { MAX_ISSUES } from '../errors';
import type { Issue, ParseError } from '../errors';
import { normalizeParameter } from '../utils';
import { FieldsParseError } from './parameter/fields/error';
import { FiltersParseError } from './parameter/filters/error';
import { PaginationParseError } from './parameter/pagination/error';
import { RelationsParseError } from './parameter/relations/error';
import { SortsParseError } from './parameter/sort/error';

/**
 * The error class each parameter rejects client input with — the default
 * reconstruction target for an issue whose site recorded no explicit class.
 */
export const PARAMETER_ERROR_CLASSES : Record<`${Parameter}`, typeof ParseError> = {
    [Parameter.FIELDS]: FieldsParseError,
    [Parameter.FILTERS]: FiltersParseError,
    [Parameter.PAGINATION]: PaginationParseError,
    [Parameter.RELATIONS]: RelationsParseError,
    [Parameter.SORTS]: SortsParseError,
    [Parameter.SORT]: SortsParseError,
};

/**
 * The trace of one parse call: every issue its sites recorded, and the
 * failure the call owes its caller.
 *
 * A collector inverts the failure policy. Instead of throwing where a
 * violation is found, a site records it and takes the drop path, so a request
 * with several bad keys reports all of them; the call that CREATED the
 * collector rebuilds the first error-severity issue and throws it at the end.
 * The rebuilt error is indistinguishable from the fail-fast one — same class,
 * same `code`, same message — so first-issue-wins holds by construction.
 *
 * A site without a collector keeps throwing immediately: `ResolutionScope` is
 * public API and usable outside a parse, where nobody would ever finish the
 * trace.
 */
export class IssueCollector {
    protected items : Issue[];

    /**
     * The caller-supplied array. Written at record time, not on finish, so a
     * structural error escaping the parse still leaves the trace behind.
     */
    protected sink : Issue[] | undefined;

    protected failure : Issue | undefined;

    /**
     * The class the failing site would have thrown, when it is not simply its
     * parameter's (a scope may be built with an explicit `errors` override).
     */
    protected failureErrors : typeof ParseError | undefined;

    /**
     * The error the failure was caught as, when it was one. The rebuilt error
     * carries it as its `cause`, so an aggregated structural failure keeps
     * the stack of the throw it actually came from.
     */
    protected failureCause : ParseError | undefined;

    constructor(sink?: Issue[]) {
        this.items = [];
        this.sink = sink;
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
        errors?: typeof ParseError,
    ) : void {
        this.record({
            ...input,
            severity: throwOnFailure ? 'error' : 'warning',
        }, errors);
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
     * orchestrator catches them here.
     */
    error(input: ParseError, parameter: `${Parameter}`, path: string[] = []) : void {
        this.record({
            code: input.code,
            parameter,
            path,
            severity: 'error',
            message: input.message,
        }, input.constructor as typeof ParseError, input);
    }

    record(
        input: Issue,
        errors?: typeof ParseError,
        cause?: ParseError,
    ) : void {
        const issue : Issue = {
            ...input,
            parameter: normalizeParameter(input.parameter) as `${Parameter}`,
        };

        if (!this.failure && issue.severity === 'error') {
            this.failure = issue;
            this.failureErrors = errors;
            this.failureCause = cause;
        }

        // the tail of a hostile request changes nothing about the outcome:
        // the failure is already pinned, and the trace is a diagnostic.
        if (this.items.length >= MAX_ISSUES) {
            return;
        }

        this.items.push(issue);

        if (this.sink) {
            this.sink.push(issue);
        }
    }

    // -----------------------------------------------------

    get issues() : Issue[] {
        return this.items;
    }

    get failed() : boolean {
        return typeof this.failure !== 'undefined';
    }

    /**
     * The error this trace owes its caller, or undefined when nothing was
     * rejected outright.
     */
    toError() : ParseError | undefined {
        if (!this.failure) {
            return undefined;
        }

        const ErrorClass = this.failureErrors ?? PARAMETER_ERROR_CLASSES[this.failure.parameter];

        return new ErrorClass({
            code: this.failure.code,
            message: this.failure.message,
            issues: this.items,
            cause: this.failureCause,
        });
    }

    throwIfFailed() : void {
        const error = this.toError();
        if (error) {
            throw error;
        }
    }
}
