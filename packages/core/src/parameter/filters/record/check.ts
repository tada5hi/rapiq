/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../../../utils';
import type { IFilter } from './types';

/**
 * A leaf `Filter` is the only condition carrying a `field`;
 * compound `Filters` nodes never do.
 */
export function isFilter(input: unknown) : input is IFilter {
    return isObject(input) &&
        typeof (input as Partial<IFilter>).field === 'string' &&
        typeof (input as Partial<IFilter>).accept === 'function';
}
