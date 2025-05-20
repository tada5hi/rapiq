/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../types';
import type { FieldsOptions } from './types';
import { FieldsSchema } from './schema';

export function defineFieldsSchema<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(options: FieldsOptions<RECORD> = {}) : FieldsSchema<RECORD> {
    return new FieldsSchema(options);
}
