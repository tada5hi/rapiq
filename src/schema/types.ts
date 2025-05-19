/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    FieldsParseOptions,
    FiltersParseOptions,
    PaginationParseOptions,
    RelationsParseOptions, SortParseOptions,
} from '../parameter';
import type { ObjectLiteral } from '../types';

export type SchemaOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    defaultPath?: string,
    throwOnFailure?: boolean,

    fields?: FieldsParseOptions<RECORD>,
    filters?: FiltersParseOptions<RECORD>,
    relations?: RelationsParseOptions<RECORD>,
    pagination?: PaginationParseOptions,
    sort? : SortParseOptions<RECORD>,
};
