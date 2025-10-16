/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Relations } from '../../../../parameter';
import type { Schema, SortSchema } from '../../../../schema';
import type { ObjectLiteral } from '../../../../types';

export type SortParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    relations?: Relations,
    throwOnFailure?: boolean,
    schema?: string | Schema<RECORD> | SortSchema<RECORD>
};
