/*
 * Copyright (c) 2026.
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
    SortsOptions,
} from '@rapiq/core';

/**
 * Marks an `allowed` list to be inherited from the model's scalar and
 * enum field names (relation fields excluded).
 */
export type InheritSentinel = 'inherit';

type WithDerivableAllowed<OPTIONS extends { allowed?: unknown }> = Omit<OPTIONS, 'allowed'> & {
    allowed?: NonNullable<OPTIONS['allowed']> | InheritSentinel,
};

export type ModelSchemaOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = BaseSchemaOptions & {
    fields?: WithDerivableAllowed<FieldsOptions<RECORD>>,
    filters?: WithDerivableAllowed<FiltersOptions<RECORD>>,
    sorts?: WithDerivableAllowed<SortsOptions<RECORD>>,
    /**
     * @deprecated use {@link ModelSchemaOptions.sorts}. Removed in 3.0.
     */
    sort?: WithDerivableAllowed<SortsOptions<RECORD>>,
    relations?: RelationsOptions<RECORD>,
    pagination?: PaginationOptions,
};

/**
 * Per-model options, keyed by the derived schema name (the
 * lower-camel model name).
 */
export type ModelSchemasOptions = Record<string, ModelSchemaOptions<any>>;

export type SchemaRegistryWithDatamodelOptions = {
    schemas?: ModelSchemasOptions,

    /**
     * Registry to extend instead of creating a new one. Schemas
     * already registered under a derived name take precedence; the
     * model is skipped.
     */
    registry?: SchemaRegistry,
};
