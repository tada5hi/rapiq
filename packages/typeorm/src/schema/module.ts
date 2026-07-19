/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ObjectLiteral,
    Schema,
    SchemaOptions,
} from '@rapiq/core';
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { camelCase } from 'change-case';
import { DataSource, EntityMetadata } from 'typeorm';
import type { EntityTarget } from 'typeorm';
import type {
    EntitySchemaOptions,
    SchemaRegistryWithDataSourceOptions,
} from './types';

export function buildEntitySchemaName(input: EntityMetadata | string) : string {
    return camelCase(typeof input === 'string' ? input : input.name);
}

function deriveColumnKeys(metadata: EntityMetadata) : string[] {
    const output : string[] = [];

    for (const column of metadata.columns) {
        // hidden (`select: false`) columns never enter derived lists;
        // virtual columns are implicit join columns of relations
        // without a declared FK property.
        if (!column.isSelect || column.isVirtual) {
            continue;
        }

        output.push(column.propertyPath);
    }

    return output;
}

function buildSchemaOptions(
    metadata: EntityMetadata,
    input: EntitySchemaOptions<any> = {},
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
    for (const relation of metadata.relations) {
        relationKeys.push(relation.propertyName);
        schemaMapping[relation.propertyName] = buildEntitySchemaName(relation.inverseEntityMetadata);
    }

    let columnKeys : string[] | undefined;
    const resolveAllowed = (allowed: unknown) => {
        if (allowed === 'columns') {
            columnKeys = columnKeys || deriveColumnKeys(metadata);
            return columnKeys;
        }

        return allowed;
    };

    const output : SchemaOptions = {
        ...base,
        name: base.name ?? buildEntitySchemaName(metadata),
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

export function defineSchemaWithEntity<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    metadata: EntityMetadata,
    options?: EntitySchemaOptions<RECORD>,
) : Schema<RECORD>;
export function defineSchemaWithEntity<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    target: EntityTarget<RECORD>,
    dataSource: DataSource,
    options?: EntitySchemaOptions<RECORD>,
) : Schema<RECORD>;
export function defineSchemaWithEntity<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    target: EntityMetadata | EntityTarget<RECORD>,
    dataSourceOrOptions?: DataSource | EntitySchemaOptions<RECORD>,
    options?: EntitySchemaOptions<RECORD>,
) : Schema<RECORD> {
    let metadata : EntityMetadata;
    let schemaOptions : EntitySchemaOptions<RECORD> | undefined;

    if (target instanceof EntityMetadata) {
        metadata = target;
        schemaOptions = dataSourceOrOptions as EntitySchemaOptions<RECORD> | undefined;
    } else {
        if (!(dataSourceOrOptions instanceof DataSource)) {
            throw new Error('A data source is required to resolve the metadata of an entity target.');
        }

        metadata = dataSourceOrOptions.getMetadata(target);
        schemaOptions = options;
    }

    return defineSchema(buildSchemaOptions(metadata, schemaOptions) as SchemaOptions<RECORD>);
}

export function defineSchemaRegistryWithDataSource(
    dataSource: DataSource,
    options: SchemaRegistryWithDataSourceOptions = {},
) : SchemaRegistry {
    const registry = options.registry || new SchemaRegistry();

    const schemasOptions = new Map<string, EntitySchemaOptions<any>>();
    if (options.schemas instanceof Map) {
        for (const [target, schemaOptions] of options.schemas) {
            schemasOptions.set(
                buildEntitySchemaName(dataSource.getMetadata(target)),
                schemaOptions,
            );
        }
    } else if (options.schemas) {
        for (const [name, schemaOptions] of Object.entries(options.schemas)) {
            schemasOptions.set(name, schemaOptions);
        }
    }

    const names = new Set<string>();
    for (const metadata of dataSource.entityMetadatas) {
        if (
            metadata.tableType === 'junction' ||
            metadata.tableType === 'closure-junction'
        ) {
            continue;
        }

        const name = buildEntitySchemaName(metadata);
        if (names.has(name)) {
            throw new Error(`The derived schema name "${name}" is not unique across the data source entities.`);
        }

        names.add(name);

        // an already registered schema (e.g. hand-written) takes precedence.
        if (registry.get(name)) {
            if (schemasOptions.has(name)) {
                throw new Error(`The schemas option key "${name}" cannot be applied, since the schema is already registered.`);
            }

            continue;
        }

        registry.add(defineSchemaWithEntity(metadata, schemasOptions.get(name)));
    }

    for (const name of schemasOptions.keys()) {
        if (!names.has(name)) {
            throw new Error(`The schemas option key "${name}" does not match any entity of the data source.`);
        }
    }

    return registry;
}
