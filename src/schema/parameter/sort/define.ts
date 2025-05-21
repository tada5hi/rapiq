/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { SortOptions } from './types';
import { SortSchema } from './schema';
import type { ObjectLiteral } from '../../../types';

export function defineSortSchema<
    T extends ObjectLiteral= ObjectLiteral,
>(
    options: SortOptions<T> = {},
) : SortSchema<T> {
    return new SortSchema(options);
}
