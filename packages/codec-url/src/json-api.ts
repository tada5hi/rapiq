/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '@rapiq/core';
import type { Issue } from '@rapiq/core';
import { URLParameter } from './constants';

const PARAMETER_WIRE_NAMES : Record<`${Parameter}`, `${URLParameter}`> = {
    [Parameter.FIELDS]: URLParameter.FIELDS,
    [Parameter.FILTERS]: URLParameter.FILTERS,
    [Parameter.PAGINATION]: URLParameter.PAGINATION,
    [Parameter.RELATIONS]: URLParameter.RELATIONS,
    [Parameter.SORTS]: URLParameter.SORT,
    [Parameter.SORT]: URLParameter.SORT,
};

/**
 * One JSON:API error object.
 *
 * `source.parameter` names the URI query parameter the issue came from, which
 * is the reason this lives in the codec: the canonical parameter a parse
 * reports (`filters`) and the parameter a client actually sent (`filter`) are
 * different vocabularies, and only the transport knows the second one.
 */
export type JsonApiError = {
    status?: string,
    code: string,
    detail: string,
    source: {
        parameter: string,
    },
    meta?: {
        /**
         * Canonical position inside the parameter, dotted.
         */
        path?: string,
        severity: string,
    },
};

export type JsonApiErrorsOptions = {
    /**
     * HTTP status to stamp on every error object, e.g. `'400'`.
     */
    status?: string,
    /**
     * Render warnings too. Off by default: a JSON:API `errors` document
     * describes what went wrong, and a dropped key under the default policy
     * did not fail the request.
     */
    warnings?: boolean,
};

/**
 * Render a parse trace as JSON:API `errors` members.
 *
 * ```ts
 * const issues: Issue[] = [];
 * const query = codec.decode(request.query, { schema: 'user', issues });
 *
 * response.status(400).json({ errors: toJsonApiErrors(issues, { status: '400' }) });
 * ```
 */
export function toJsonApiErrors(
    input: readonly Issue[],
    options: JsonApiErrorsOptions = {},
) : JsonApiError[] {
    const output : JsonApiError[] = [];

    for (const issue of input) {
        if (issue.severity !== 'error' && !options.warnings) {
            continue;
        }

        const error : JsonApiError = {
            code: issue.code,
            detail: issue.message,
            source: { parameter: PARAMETER_WIRE_NAMES[issue.parameter] ?? issue.parameter },
        };

        if (options.status) {
            error.status = options.status;
        }

        error.meta = { severity: issue.severity };
        if (issue.path.length > 0) {
            error.meta.path = issue.path.join('.');
        }

        output.push(error);
    }

    return output;
}
