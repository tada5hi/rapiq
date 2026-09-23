/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { IAggregates, IAggregatesVisitor } from './types';

/**
 * An `Aggregates` collection is identified by its visitor dispatch:
 * accept() of an aggregates node calls visitAggregates and nothing else.
 */
export function isAggregates(input: unknown) : input is IAggregates {
    return dispatchesTo<IAggregatesVisitor<unknown>>(input, 'visitAggregates');
}
