/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import type { PaginationSchema, Schema } from '../../../schema';

export type PaginationParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    schema?: string | Schema<RECORD> | PaginationSchema
};
