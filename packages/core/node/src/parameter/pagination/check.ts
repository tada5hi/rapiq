/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../utils';
import type { IPagination, IPaginationVisitor } from './types';

/**
 * A `Pagination` node is identified by its visitor dispatch: accept()
 * of a pagination node calls visitPagination and nothing else. Works
 * across package instances, where instanceof fails.
 */
export function isPagination(input: unknown) : input is IPagination {
    return dispatchesTo<IPaginationVisitor<unknown>>(input, 'visitPagination');
}
