/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { arrayToPath } from 'pathtrace';
import { flattenIssueItems } from 'blemish';
import type { Issue } from 'blemish';
import { extractIssueParameter } from '@rapiq/core';
import { PARAMETER_WIRE_NAMES } from './constants';
import type { FormatErrorsOptions, FormattedError } from './types';

/**
 * Normalize the trace an error carries into this codec's response format.
 *
 * A trace is a tree: what a group stands for is already said by the leaves
 * below it, so only those are rendered — one error per rejected key, each at
 * the absolute position merging gave it.
 *
 * ```ts
 * try {
 *     codec.decode(request.query, { schema: 'user' });
 * } catch (e) {
 *     response.status(400).json({ errors: formatErrors(e.issues, { status: '400' }) });
 * }
 * ```
 */
export function formatErrors(
    input: readonly Issue[],
    options: FormatErrorsOptions = {},
) : FormattedError[] {
    const output : FormattedError[] = [];

    for (const issue of flattenIssueItems([...input])) {
        const error : FormattedError = {
            code: issue.code,
            detail: issue.message,
        };

        const parameter = extractIssueParameter(issue);
        if (parameter) {
            error.source = { parameter: PARAMETER_WIRE_NAMES[parameter] ?? parameter };
        }

        if (options.status) {
            error.status = options.status;
        }

        if (issue.path.length > 0) {
            error.meta = { path: arrayToPath(issue.path) };
        }

        output.push(error);
    }

    return output;
}
