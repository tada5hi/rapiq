/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { IGroups, IGroupsVisitor } from './types';

/**
 * A `Groups` collection is identified by its visitor dispatch: accept()
 * of a groups node calls visitGroups and nothing else, which tells it
 * apart from the structurally identical collection nodes.
 */
export function isGroups(input: unknown) : input is IGroups {
    return dispatchesTo<IGroupsVisitor<unknown>>(input, 'visitGroups');
}
