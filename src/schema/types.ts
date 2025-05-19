/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    FieldsOptions, FiltersOptions, PaginationOptions, RelationsOptions, SortOptions,
} from '../parameter';
import type { ObjectLiteral } from '../types';

export type SchemaOptionsNormalized<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {

    defaultPath?: string,
    throwOnFailure?: boolean,

    fields: FieldsOptions<RECORD>,
    filters: FiltersOptions<RECORD>,
    relations: RelationsOptions<RECORD>,
    pagination: PaginationOptions,
    sort : SortOptions<RECORD>,
};

export type SchemaOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = Partial<SchemaOptionsNormalized<RECORD>>;

// --------------------------------------------------------------

// --------------------------------------------------------------
