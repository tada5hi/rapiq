/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '../condition';
import type { IFilters } from './types';

export function isFilters(
    input: ICondition,
    operator?: string,
) : input is IFilters {
    if (!Array.isArray(input)) return false;

    if (operator) {
        return operator === input.operator;
    }

    return true;
}
