/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import type { FieldsSchema, Schema } from '../../../schema';
import type { Relations } from '../../../parameter';

export type FieldsParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    relations?: Relations,
    schema?: string | Schema<RECORD> | FieldsSchema<RECORD>,
    isChild?: boolean
};
