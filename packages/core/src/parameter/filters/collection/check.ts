/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '../condition';
import { dispatchesTo } from '../../../utils';
import type { IFilters, IFiltersVisitor } from './types';

export function isFilters(
    input: ICondition,
    operator?: string,
) : input is IFilters {
    if (!dispatchesTo<IFiltersVisitor<unknown>>(input, 'visitFilters')) {
        return false;
    }

    return operator ? operator === input.operator : true;
}
