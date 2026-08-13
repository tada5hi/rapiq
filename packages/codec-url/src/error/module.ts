/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { arrayToPath } from 'pathtrace';
import type { Issue } from '@rapiq/core';
import { PARAMETER_WIRE_NAMES } from './constants';
import type { FormatErrorsOptions, FormattedError } from './types';

/**
 * Normalize the trace an error carries into this codec's response format.
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

    for (const issue of input) {
        if (issue.severity !== 'error' && !options.warnings) {
            continue;
        }

        const error : FormattedError = {
            code: issue.code,
            detail: issue.message,
            source: { parameter: PARAMETER_WIRE_NAMES[issue.parameter] ?? issue.parameter },
        };

        if (options.status) {
            error.status = options.status;
        }

        error.meta = { severity: issue.severity };
        if (issue.path.length > 0) {
            error.meta.path = arrayToPath(issue.path);
        }

        output.push(error);
    }

    return output;
}
