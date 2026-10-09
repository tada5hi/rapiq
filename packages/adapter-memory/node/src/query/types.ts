/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Comparator,
    Predicate,
    Projector,
    Slicer,
} from '../types';

export type CompiledQueryContext<T> = {
    predicate: Predicate,
    comparator?: Comparator<T>,
    projector?: Projector<T>,
    slicer: Slicer,
    pagination: {
        limit?: number,
        offset?: number
    }
};
