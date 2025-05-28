/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition } from '@ucast/core';
import type { FiltersSchema, Schema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';

export type FiltersParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    relations?: string[],
    schema?: string | Schema<RECORD> | FiltersSchema<RECORD>
};

export type FiltersParseOutput = Condition;
