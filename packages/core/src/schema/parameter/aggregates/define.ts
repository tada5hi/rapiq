/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import { AggregatesSchema } from './schema';
import type { AggregatesOptions } from './types';

export function defineAggregatesSchema<T extends ObjectLiteral = ObjectLiteral>(
    options: AggregatesOptions<T> = {},
) : AggregatesSchema<T> {
    return new AggregatesSchema(options);
}
