/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import type { FiltersOptions } from './types';
import { FiltersSchema } from './schema';

export function defineFiltersSchema<
    RECORD extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
>(options: FiltersOptions<RECORD, CONTEXT> = {}) : FiltersSchema<RECORD, CONTEXT> {
    return new FiltersSchema(options);
}
