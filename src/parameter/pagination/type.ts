/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../constants';
import { ParseOptionsBase } from '../type';

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

export type PaginationBuildInput<T> = {
    limit?: number,
    offset?: number
};

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------

export type PaginationParseOptions = {
    maxLimit?: number
} & ParseOptionsBase<Parameter.PAGINATION>;

export type PaginationParseOutput = {
    limit?: number,
    offset?: number
} & ParseOptionsBase<Parameter.PAGINATION>;
