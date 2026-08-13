/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * One formatted error, as this codec normalizes it for a response body.
 *
 * The members follow the JSON:API error object rapiq's query vocabulary is
 * modelled on, so the output drops straight into an `errors` array, but the
 * shape is this package's: `source.parameter` names the URI query parameter
 * the issue came from, which is a fact only the transport holds.
 */
export type FormattedError = {
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

export type FormatErrorsOptions = {
    /**
     * HTTP status to stamp on every error, e.g. `'400'`.
     */
    status?: string,
    /**
     * Format the warnings that rode along behind the failure too. Off by
     * default: a clamped limit or a substituted default is not what went
     * wrong with the request.
     */
    warnings?: boolean,
};
