/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { IAggregate, IAggregateVisitor } from './types';

/**
 * An `Aggregate` record is identified by its visitor dispatch: accept()
 * of an aggregate node calls visitAggregate and nothing else.
 */
export function isAggregate(input: unknown) : input is IAggregate {
    return dispatchesTo<IAggregateVisitor<unknown>>(input, 'visitAggregate');
}
