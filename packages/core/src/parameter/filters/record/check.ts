/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { IFilter, IFilterVisitor } from './types';

export function isFilter(input: unknown) : input is IFilter {
    return dispatchesTo<IFilterVisitor<unknown>>(input, 'visitFilter');
}
