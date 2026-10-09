/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { ISorts, ISortsVisitor } from './types';

/**
 * A `Sorts` collection is identified by its visitor dispatch: accept()
 * of a sorts node calls visitSorts and nothing else. Works across
 * package instances, where instanceof fails, and distinguishes the
 * structurally identical collection nodes (Sorts, Fields, ...).
 */
export function isSorts(input: unknown) : input is ISorts {
    return dispatchesTo<ISortsVisitor<unknown>>(input, 'visitSorts');
}
