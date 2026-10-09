/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { IGroup, IGroupVisitor } from './types';

/**
 * A `Group` record is identified by its visitor dispatch: accept() of a
 * group node calls visitGroup and nothing else. Works across package
 * instances, where instanceof fails.
 */
export function isGroup(input: unknown) : input is IGroup {
    return dispatchesTo<IGroupVisitor<unknown>>(input, 'visitGroup');
}
