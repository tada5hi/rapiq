/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { SortsOptions } from './types';
import { SortsSchema } from './schema';
import type { ObjectLiteral } from '../../../types';

export function defineSortsSchema<
    T extends ObjectLiteral= ObjectLiteral,
    CONTEXT = any,
>(
    options: SortsOptions<T, CONTEXT> = {},
) : SortsSchema<T, CONTEXT> {
    return new SortsSchema(options);
}
