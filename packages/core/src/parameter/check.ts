/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../utils';
import type { IQuery, IQueryVisitor } from './types';

/**
 * A `Query` node is identified by its visitor dispatch: accept() of a
 * query node calls visitQuery and nothing else. Works across package
 * instances, where instanceof fails.
 */
export function isQuery(input: unknown) : input is IQuery {
    return dispatchesTo<IQueryVisitor<unknown>>(input, 'visitQuery');
}
