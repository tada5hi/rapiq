/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import type { FieldsOptions } from './types';
import { FieldsSchema } from './schema';

export function defineFieldsSchema<
    RECORD extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
>(options: FieldsOptions<RECORD, CONTEXT> = {}) : FieldsSchema<RECORD, CONTEXT> {
    return new FieldsSchema(options);
}
