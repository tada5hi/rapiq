/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    FieldsOptions,
    FieldsSchema,
    FiltersOptions,
    FiltersSchema,
    PaginationOptions,
    PaginationSchema,
    RelationsOptions,
    RelationsSchema,
    SortOptions,
    SortSchema,
} from '../parameter';
import type { ObjectLiteral } from '../types';

export type BaseSchemaOptions = {
    defaultPath?: string,
    throwOnFailure?: boolean,
};

export type SchemaOptionsNormalized<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = BaseSchemaOptions & {
    fields: FieldsOptions<RECORD> | FieldsSchema<RECORD>,
    filters: FiltersOptions<RECORD> | FiltersSchema<RECORD>,
    relations: RelationsOptions<RECORD> | RelationsSchema<RECORD>,
    pagination: PaginationOptions | PaginationSchema,
    sort : SortOptions<RECORD> | SortSchema<RECORD>,
};

export type SchemaOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = Partial<SchemaOptionsNormalized<RECORD>>;
