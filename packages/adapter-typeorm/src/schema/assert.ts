/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, ObjectLiteral, Schema } from '@rapiq/core';
import {
    ErrorCode, 
    SchemaError, 
    isFilter, 
    isFilters,
} from '@rapiq/core';
import { DataSource, EntityMetadata } from 'typeorm';
import type { EntityTarget } from 'typeorm';
import { SchemaEntityIndexMismatchError, SchemaEntityMismatchError } from '../errors';

/**
 * Verify that every key referenced by the schema exists on the entity:
 * plain keys must be column property paths (embedded paths included),
 * dotted keys must be headed by a relation, and `relations.allowed`
 * keys must be relation property names. Turns silent schema/entity
 * drift (e.g. a renamed column) into a boot-time failure instead of
 * a dead allow-list entry or a runtime adapter error.
 *
 * Declared `indexes` are verified on top: every sequence must be a
 * leftmost prefix of the primary key, of a unique constraint or of
 * an index of the entity, so an index policy cannot outlive the
 * index it promises.
 *
 * @throws SchemaEntityMismatchError carrying every offending key.
 * @throws SchemaEntityIndexMismatchError carrying every unbacked
 *         index sequence.
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
            throw new SchemaError({
                message: 'A data source is required to resolve the metadata of an entity target.',
                code: ErrorCode.INPUT_INVALID,
            });
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

    checkColumnKeys(schema.sorts.allowed);
    checkColumnKeys(schema.sorts.defaultKeys);

    // an index key is a column of the entity's own table: a drifted
    // one is reported as such rather than as an unbacked sequence.
    checkColumnKeys(schema.indexes);

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

    // every declared index sequence must be a leftmost prefix of a
    // real one: the primary key, a unique constraint or an index.
    // Both lists are consulted, since a `@Unique` lands in `indices`
    // on the mysql family and a unique `@Index` in `uniques` on
    // cockroachdb.
    const sequences : string[][] = [
        metadata.primaryColumns.map((column) => column.propertyPath),
        ...metadata.uniques.map((unique) => unique.columns.map(
            (column) => column.propertyPath,
        )),
        ...metadata.indices.map((index) => index.columns.map(
            (column) => column.propertyPath,
        )),
    ];

    // a declared prefix is served by any longer real index, never the
    // other way round.
    const indexes = schema.indexes.filter((index) => !sequences.some(
        (sequence) => index.length <= sequence.length &&
            index.every((key, position) => sequence[position] === key),
    ));

    if (indexes.length > 0) {
        throw new SchemaEntityIndexMismatchError({
            schema: schema.name,
            entity: metadata.name,
            indexes,
        });
    }
}
