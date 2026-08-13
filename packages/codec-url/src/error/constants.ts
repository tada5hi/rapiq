/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '@rapiq/core';
import { URLParameter } from '../constants';

/**
 * The wire name each canonical parameter answers to. This is the whole reason
 * the formatting lives in the codec: a parse reports the parameter that owns
 * the policy (`filters`), and only the transport knows the client sent it as
 * `filter`.
 */
export const PARAMETER_WIRE_NAMES : Record<`${Parameter}`, `${URLParameter}`> = {
    [Parameter.FIELDS]: URLParameter.FIELDS,
    [Parameter.FILTERS]: URLParameter.FILTERS,
    [Parameter.PAGINATION]: URLParameter.PAGINATION,
    [Parameter.RELATIONS]: URLParameter.RELATIONS,
    [Parameter.SORTS]: URLParameter.SORT,
    [Parameter.SORT]: URLParameter.SORT,
};
