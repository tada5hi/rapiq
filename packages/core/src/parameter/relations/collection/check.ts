/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { IRelations, IRelationsVisitor } from './types';

/**
 * A `Relations` collection is identified by its visitor dispatch:
 * accept() of a relations node calls visitRelations and nothing else.
 * Works across package instances, where instanceof fails, and
 * distinguishes the structurally identical collection nodes
 * (Relations, Sorts, ...).
 */
export function isRelations(input: unknown) : input is IRelations {
    return dispatchesTo<IRelationsVisitor<unknown>>(input, 'visitRelations');
}
