/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, ObjectLiteral, Schema } from '@rapiq/core';
import { isFilter, isFilters } from '@rapiq/core';
import { DataSource, EntityMetadata } from 'typeorm';
import type { EntityTarget } from 'typeorm';
import { SchemaEntityMismatchError } from '../errors';

/**
 * Verify that every key referenced by the schema exists on the entity:
 * plain keys must be column property paths (embedded paths included),
 * dotted keys must be headed by a relation, and `relations.allowed`
 * keys must be relation property names. Turns silent schema/entity
 * drift (e.g. a renamed column) into a boot-time failure instead of
 * a dead allow-list entry or a runtime adapter error.
 *
 * @throws SchemaEntityMismatchError carrying every offending key.
 */
export function assertSchemaMatchesEntity<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    schema: Schema<RECORD>,
    metadata: EntityMetadata,
) : void;
export function assertSchemaMatchesEntity<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    schema: Schema<RECORD>,
    target: EntityTarget<RECORD>,
    dataSource: DataSource,
) : void;
export function assertSchemaMatchesEntity<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    schema: Schema<RECORD>,
    target: EntityMetadata | EntityTarget<RECORD>,
    dataSource?: DataSource,
) : void {
    let metadata : EntityMetadata;
    if (target instanceof EntityMetadata) {
        metadata = target;
    } else {
        if (!(dataSource instanceof DataSource)) {
            throw new Error('A data source is required to resolve the metadata of an entity target.');
        }

        metadata = dataSource.getMetadata(target);
    }

    const columns = new Set<string>(metadata.columns.map(
        (column) => column.propertyPath,
    ));
    const relations = new Set<string>(metadata.relations.map(
        (relation) => relation.propertyName,
    ));

    const invalid = new Set<string>();

    const headOf = (key: string) => {
        const index = key.indexOf('.');
        return index === -1 ? key : key.substring(0, index);
    };

    const checkColumnKey = (key: unknown) => {
        if (typeof key !== 'string' || columns.has(key)) {
            return;
        }

        // dotted keys not matching a column path (embedded)
        // must be headed by a relation — the remainder belongs
        // to the related entity's own schema.
        const head = headOf(key);
        if (head !== key && relations.has(head)) {
            return;
        }

        invalid.add(key);
    };
    const checkColumnKeys = (keys: string[] | string[][]) => {
        for (const key of keys.flat()) {
            checkColumnKey(key);
        }
    };
    // a filters default is a condition tree, not a key list — walk it
    // and validate every leaf field like a filters allow-list entry.
    const checkCondition = (condition: ICondition) => {
        if (isFilters(condition)) {
            for (const child of condition.value) {
                checkCondition(child);
            }
            return;
        }

        if (isFilter(condition)) {
            checkColumnKey(condition.field);
        }
    };

    checkColumnKeys(schema.fields.default);
    checkColumnKeys(schema.fields.allowed);

    checkColumnKeys(schema.filters.allowed);
    if (schema.filters.default) {
        checkCondition(schema.filters.default);
    }

    checkColumnKeys(schema.sort.allowed);
    checkColumnKeys(schema.sort.defaultKeys);

    // relation keys resolve against relations only — the first
    // (or sole) segment must be a relation property name.
    for (const key of schema.relations.allowed || []) {
        if (!relations.has(headOf(key))) {
            invalid.add(key);
        }
    }

    if (invalid.size > 0) {
        throw new SchemaEntityMismatchError({
            schema: schema.name,
            entity: metadata.name,
            keys: [...invalid],
        });
    }
}
