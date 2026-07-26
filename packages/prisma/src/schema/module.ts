/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ObjectLiteral,
    Schema,
    SchemaOptions,
} from '@rapiq/core';
import {
    AdapterError,
    ErrorCode,
    SchemaRegistry,
    defineSchema,
} from '@rapiq/core';
import { camelCase } from 'change-case';
import type { Datamodel, DatamodelModel } from '../metadata';
import type {
    ModelSchemaOptions,
    SchemaRegistryWithDatamodelOptions,
} from './types';

const RELATION_KIND = 'object';

export function buildModelSchemaName(input: DatamodelModel | string) : string {
    return camelCase(typeof input === 'string' ? input : input.name);
}

function resolveModel(datamodel: Datamodel, name: string) : DatamodelModel {
    const model = datamodel.models.find((item) => item.name === name);
    if (!model) {
        throw new AdapterError({
            message: `The model "${name}" is not part of the datamodel.`,
            code: ErrorCode.SCHEMA_UNRESOLVABLE,
        });
    }

    return model;
}

/**
 * Scalar and enum field names; relation fields are keys of the
 * related model's own schema, never of this one.
 */
function deriveColumnKeys(model: DatamodelModel) : string[] {
    const output : string[] = [];

    for (const field of model.fields) {
        if (field.kind === RELATION_KIND) {
            continue;
        }

        output.push(field.name);
    }

    return output;
}

/**
 * Derivation supplies *shape*: the schema name, the relation
 * traversal map and, on request (`allowed: 'inherit'`), the model's
 * field names. Authorization stays explicit; a derived schema without
 * per-parameter options allows nothing more than a hand-written one.
 */
function buildSchemaOptions(
    model: DatamodelModel,
    input: ModelSchemaOptions<any> = {},
) : SchemaOptions {
    const {
        fields,
        filters,
        sort,
        relations,
        pagination,
        ...base
    } = input;

    const relationKeys : string[] = [];
    const schemaMapping : Record<string, string> = {};
    for (const field of model.fields) {
        if (field.kind !== RELATION_KIND) {
            continue;
        }

        relationKeys.push(field.name);
        schemaMapping[field.name] = buildModelSchemaName(field.type);
    }

    let columnKeys : string[] | undefined;
    const resolveAllowed = (allowed: unknown) => {
        if (allowed === 'inherit') {
            columnKeys = columnKeys || deriveColumnKeys(model);
            return columnKeys;
        }

        return allowed;
    };

    const output : SchemaOptions = {
        ...base,
        name: base.name ?? buildModelSchemaName(model),
        schemaMapping: { ...schemaMapping, ...base.schemaMapping },
        relations: {
            allowed: relationKeys,
            ...relations,
        },
    };

    if (fields) {
        output.fields = { ...fields, allowed: resolveAllowed(fields.allowed) } as SchemaOptions['fields'];
    }

    if (filters) {
        output.filters = { ...filters, allowed: resolveAllowed(filters.allowed) } as SchemaOptions['filters'];
    }

    if (sort) {
        output.sort = { ...sort, allowed: resolveAllowed(sort.allowed) } as SchemaOptions['sort'];
    }

    if (pagination) {
        output.pagination = pagination;
    }

    return output;
}

/**
 * Define a schema for one model of a prisma datamodel
 * (`Prisma.dmmf.datamodel`, or any object of the same shape).
 *
 * ```typescript
 * const schema = defineSchemaWithModel<User>(Prisma.dmmf.datamodel, 'User', {
 *     fields: { allowed: 'inherit' },
 *     filters: { allowed: ['id', 'name'] },
 * });
 * ```
 */
export function defineSchemaWithModel<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    datamodel: Datamodel,
    model: string,
    options?: ModelSchemaOptions<RECORD>,
) : Schema<RECORD> {
    return defineSchema(buildSchemaOptions(
        resolveModel(datamodel, model),
        options,
    ) as SchemaOptions<RECORD>);
}

/**
 * Register one derived schema per model of the datamodel, named by
 * the lower-camel model name. Hand-written schemas already present in
 * the registry take precedence; per-model options are keyed by the
 * derived name.
 */
export function defineSchemaRegistryWithDatamodel(
    datamodel: Datamodel,
    options: SchemaRegistryWithDatamodelOptions = {},
) : SchemaRegistry {
    const registry = options.registry || new SchemaRegistry();
    const schemasOptions = options.schemas || {};

    const names = new Set<string>();
    for (const model of datamodel.models) {
        const name = buildModelSchemaName(model);
        if (names.has(name)) {
            throw new Error(`The derived schema name "${name}" is not unique across the datamodel.`);
        }

        names.add(name);

        // an already registered schema (e.g. hand-written) takes precedence.
        if (registry.get(name)) {
            if (schemasOptions[name]) {
                throw new Error(`The schemas option key "${name}" cannot be applied, since the schema is already registered.`);
            }

            continue;
        }

        registry.add(defineSchemaWithModel(datamodel, model.name, schemasOptions[name]));
    }

    for (const name of Object.keys(schemasOptions)) {
        if (!names.has(name)) {
            throw new Error(`The schemas option key "${name}" does not match any model of the datamodel.`);
        }
    }

    return registry;
}
