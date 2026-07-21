/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { RelationsSchema } from './schema';
import type { ObjectLiteral } from '../../../types';
import type { RelationsOptions } from './types';

export function defineRelationsSchema<
    T extends ObjectLiteral= ObjectLiteral,
    CONTEXT = any,
>(
    options: RelationsOptions<T, CONTEXT> = {},
) : RelationsSchema<T, CONTEXT> {
    return new RelationsSchema(options);
}
