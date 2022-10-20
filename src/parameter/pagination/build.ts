/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { merge } from 'smob';
import { ObjectLiteral } from '../../type';
import { PaginationBuildInput } from './type';

export function mergeQueryPagination<T extends ObjectLiteral = ObjectLiteral>(
    target?: PaginationBuildInput<T>,
    source?: PaginationBuildInput<T>,
) : PaginationBuildInput<T> {
    return merge({}, target || {}, source || {});
}
