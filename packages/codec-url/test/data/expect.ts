/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, ParseError } from '@rapiq/core';
import { flattenIssueItems } from 'blemish';

/**
 * Assert that a parse rejected its input, and that the violation `expected`
 * describes is in the trace it raised.
 *
 * A parse raises one general `INPUT_REJECTED` error carrying every issue,
 * because a request can violate several policies at once and an error naming
 * one of them would describe a subset. What used to be asserted against the
 * throw is therefore asserted against the trace; the expectation is still
 * written as the error the failing site would throw on its own, which is what
 * a `ResolutionScope` outside a parse still does.
 */
export function expectRejected(
    fn: () => unknown,
    expected?: { code?: string, message?: string },
) : void {
    let error : ParseError | undefined;

    try {
        fn();
    } catch (e) {
        error = e as ParseError;
    }

    expect(error).toBeInstanceOf(ParseError);
    expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);

    if (!expected) {
        return;
    }

    const items = flattenIssueItems([...(error?.issues ?? [])]);
    const matcher : Record<string, unknown> = {};
    if (typeof expected.code !== 'undefined') {
        matcher.code = expected.code;
    }

    if (typeof expected.message !== 'undefined') {
        matcher.message = expected.message;
    }

    expect(items).toContainEqual(expect.objectContaining(matcher));
}
