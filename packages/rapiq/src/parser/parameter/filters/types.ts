/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Relations } from '../../../parameter';
import type { FiltersSchema, Schema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import type { IParserOptions } from '../../types';

export type FiltersParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = IParserOptions & {
    relations?: Relations,
    schema?: string | Schema<RECORD> | FiltersSchema<RECORD>,
    throwOnFailure?: boolean
};
