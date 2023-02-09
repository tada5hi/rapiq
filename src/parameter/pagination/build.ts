/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { merge } from 'smob';
import { PaginationBuildInput } from './type';

export function mergeQueryPagination(
    target?: PaginationBuildInput,
    source?: PaginationBuildInput,
) : PaginationBuildInput {
    return merge({}, target || {}, source || {});
}
