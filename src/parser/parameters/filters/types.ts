/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterValueSimple } from '../../../builder';
import type { FilterComparisonOperator } from '../../../schema';

export type FiltersParseOutputElement = {
    operator?: `${FilterComparisonOperator}`,
    value: FilterValueSimple,
    key: string,
    path?: string
};

export type FiltersParseOutput = FiltersParseOutputElement[];
