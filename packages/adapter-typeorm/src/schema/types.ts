/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    BaseSchemaOptions,
    FieldsOptions,
    FiltersOptions,
    ObjectLiteral,
    PaginationOptions,
    RelationsOptions,
    SchemaRegistry,
    SortOptions,
} from '@rapiq/core';
import type { EntityTarget } from 'typeorm';

/**
 * Marks an `allowed` list to be inherited from the entity's column
 * property paths (hidden `select: false` columns and virtual join
 * columns excluded).
 */
export type InheritSentinel = 'inherit';

type WithDerivableAllowed<OPTIONS extends { allowed?: unknown }> = Omit<OPTIONS, 'allowed'> & {
    allowed?: NonNullable<OPTIONS['allowed']> | InheritSentinel,
};

export type EntitySchemaOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = BaseSchemaOptions & {
    fields?: WithDerivableAllowed<FieldsOptions<RECORD>>,
    filters?: WithDerivableAllowed<FiltersOptions<RECORD>>,
    sort?: WithDerivableAllowed<SortOptions<RECORD>>,
    relations?: RelationsOptions<RECORD>,
    pagination?: PaginationOptions,
};

export type EntitySchemasOptions =    Record<string, EntitySchemaOptions<any>> |
    Map<EntityTarget<any>, EntitySchemaOptions<any>>;

export type SchemaRegistryWithDataSourceOptions = {
    /**
     * Per-entity options, keyed by the derived schema name
     * (lower-camel entity name) or by the entity class itself.
     */
    schemas?: EntitySchemasOptions,

    /**
     * Registry to extend instead of creating a new one.
     * Schemas already registered under a derived name take
     * precedence — the entity is skipped.
     */
    registry?: SchemaRegistry,
};
