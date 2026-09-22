/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IAggregate, IAggregates } from '../../../parameter';
import type { CallBuildInput } from '../call';

/**
 * Untyped by the record: an aggregate term names a function, never a
 * column, and its column arguments are strings inside `params`.
 */
export type AggregatesBuildInput = (string | CallBuildInput | IAggregate)[] | IAggregates;
