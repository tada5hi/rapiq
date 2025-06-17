/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Schema, SortDirection, SortSchema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import type { RelationsParseOutput } from '../relations';

export type SortParseOutput = Record<string, `${SortDirection}`>;

export type SortParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    relations?: RelationsParseOutput,
    throwOnFailure?: boolean,
    schema?: string | Schema<RECORD> | SortSchema<RECORD>
};
