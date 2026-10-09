/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { ISort, ISortVisitor } from './types';

/**
 * A `Sort` record is identified by its visitor dispatch: accept() of a
 * sort node calls visitSort and nothing else. Works across package
 * instances, where instanceof fails, and distinguishes the structurally
 * overlapping record nodes (Sort, Field, Relation).
 */
export function isSort(input: unknown) : input is ISort {
    return dispatchesTo<ISortVisitor<unknown>>(input, 'visitSort');
}
