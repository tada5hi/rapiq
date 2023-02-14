/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

export type PaginationBuildInput = {
    limit?: number,
    offset?: number
};

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------

export type PaginationParseOptions = {
    maxLimit?: number
};

export type PaginationParseOutput = {
    limit?: number,
    offset?: number
};
