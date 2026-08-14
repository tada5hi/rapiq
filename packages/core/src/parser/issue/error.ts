/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ParseError } from '../../errors';
import type { IParseError } from '../../errors';
import type { IIssueCollector } from './types';

/**
 * The failure a trace stands for, or undefined when nothing was rejected.
 *
 * One general `ParseError` (`INPUT_REJECTED`) carrying every issue, never the
 * first violation's own class and code. A request can violate several policies
 * at once — a bad `fields` key, a bad `filters` key, a rejected relation — and
 * an error advertising one of them describes a subset of what went wrong,
 * which is worse than describing none of it: a consumer branching on the class
 * acts on the part it happened to be handed.
 *
 * `error.issues` is where what-and-where lives, and `formatErrors` renders it.
 * The parameter-specific classes stay what a SINGLE violation throws where no
 * trace is collecting (a `ResolutionScope` used outside a parse) — exactly the
 * case where naming one parameter is the whole truth.
 *
 * A structural abort caught on the way rides along as `cause`, so the stack of
 * the original throw survives without deciding what the parse raises.
 *
 * Deliberately not a method on the collector: collecting evidence and deciding
 * what to raise from it are separate jobs, and only the call that owns the
 * parse is in a position to do the second.
 */
export function buildErrorFromIssueCollector(input: IIssueCollector) : IParseError | undefined {
    if (!input.failed) {
        return undefined;
    }

    return ParseError.inputRejected(input.issues, input.cause);
}

/**
 * Raise what a trace collected, if anything was rejected.
 */
export function raiseErrorFromIssueCollector(input: IIssueCollector) : void {
    const error = buildErrorFromIssueCollector(input);
    if (error) {
        throw error;
    }
}
