/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { RelationsOptions } from './types';
import { RelationsSchema } from './schema';
import type { ObjectLiteral } from '../../types';

export function defineRelationsSchema<
    T extends ObjectLiteral= ObjectLiteral,
>(
    options: RelationsOptions<T> = {},
) : RelationsSchema<T> {
    return new RelationsSchema(options);
}
