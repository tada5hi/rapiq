/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IPagination } from '../../../parameter';
import { Pagination } from '../../../parameter';
import { isParameterNode } from '../../utils';
import type { PaginationBuildInput } from './types';

export function definePagination(
    input: PaginationBuildInput | IPagination,
) : IPagination {
    if (isParameterNode<IPagination>(input)) {
        return input;
    }

    return new Pagination(input.limit, input.offset);
}
