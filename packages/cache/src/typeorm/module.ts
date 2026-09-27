/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Schema, SchemaRegistry } from '@rapiq/core';
import type {
    EntityMetadata,
    EntitySubscriberInterface,
    InsertEvent,
    ObjectLiteral,
    QueryRunner,
    RecoverEvent,
    RelationMetadata,
    RemoveEvent,
    SoftRemoveEvent,
    TransactionCommitEvent,
    UpdateEvent,
} from 'typeorm';
import { CacheError } from '../errors';
import {
    buildCollectionTag,
    buildRecordTag,
    buildScopedTag,
    isScopedTagValue,
} from '../tag';
import type { ITaggedCache } from '../types';
import { CACHE_INVALIDATION_PENDING_KEY } from './constants';
import type { CacheInvalidationSubscriberOptions } from './types';

/**
 * The write side for TypeORM: bumps the tags of every written row, after
 * the transaction that wrote it committed.
 *
 * The class carries no `@EventSubscriber` decorator and imports nothing
 * from `typeorm` at runtime, so the package stays free of it. Register an
 * instance by pushing it onto `dataSource.subscribers` AFTER
 * `initialize()`: the `subscribers` option only instantiates decorated
 * classes and drops an instance, and `initialize()` replaces the array.
 *
 * The bump after commit is what makes the model correct: a reader can still
 * see the pre-commit rows while the transaction is open, and a bump inside
 * it would let that reader store them with a clock the bump predates. So
 * tags collect in the query runner while a transaction is active and are
 * bumped once, at depth 0.
 */
export class CacheInvalidationSubscriber implements EntitySubscriberInterface {
    protected cache : Pick<ITaggedCache, 'invalidate'>;

    protected registry : SchemaRegistry;

    protected resolveSchemaName : (metadata: EntityMetadata) => string | undefined;

    protected onError : (error: unknown) => void;

    /**
     * Per entity: the tags a removed row of it bumps on the children the
     * database changes without a hook (`onDelete` CASCADE or SET NULL).
     */
    protected cascades : WeakMap<EntityMetadata, CascadeDependency[]>;

    constructor(options: CacheInvalidationSubscriberOptions) {
        this.cache = options.cache;
        this.registry = options.registry;
        this.resolveSchemaName = options.resolveSchemaName;
        this.onError = options.onError ?? (() => {});
        this.cascades = new WeakMap();
    }

    async afterInsert(event: InsertEvent<ObjectLiteral>) : Promise<void> {
        await this.collect(event.queryRunner, [
            ...this.buildRowTags(event.metadata, event.entity),
            ...this.buildJunctionTags(event.metadata, event.entityId ?? event.entity),
        ]);
    }

    async afterUpdate(event: UpdateEvent<ObjectLiteral>) : Promise<void> {
        // a scoped column may have changed value: bump the old and the new.
        await this.collect(event.queryRunner, [
            ...this.buildRowTags(event.metadata, event.entity),
            ...this.buildRowTags(event.metadata, event.databaseEntity),
        ]);
    }

    async afterRemove(event: RemoveEvent<ObjectLiteral>) : Promise<void> {
        const row = event.databaseEntity ?? event.entity;

        await this.collect(event.queryRunner, [
            ...this.buildRowTags(event.metadata, row),
            ...this.buildJunctionTags(event.metadata, event.entityId ?? row),
            ...this.buildCascadeTags(event.dataSource.entityMetadatas, event.metadata, row),
        ]);
    }

    /**
     * A soft remove or a recover is an UPDATE of the delete-date column
     * that moves the row out of, or back into, every result: the row's own
     * tags are bumped like on a remove. No cascade tags, since the database
     * cascades nothing on an update. The query-builder form
     * (`Repository.softDelete` / `restore`) hands no entity and yields the
     * collection tag alone.
     */
    async afterSoftRemove(event: SoftRemoveEvent<ObjectLiteral>) : Promise<void> {
        await this.collect(
            event.queryRunner,
            this.buildRowTags(event.metadata, event.databaseEntity ?? event.entity),
        );
    }

    async afterRecover(event: RecoverEvent<ObjectLiteral>) : Promise<void> {
        await this.collect(
            event.queryRunner,
            this.buildRowTags(event.metadata, event.databaseEntity ?? event.entity),
        );
    }

    async afterTransactionCommit(event: TransactionCommitEvent) : Promise<void> {
        // a released savepoint: the outermost transaction is still open.
        if (event.queryRunner.isTransactionActive) {
            return;
        }

        const pending = event.queryRunner.data[CACHE_INVALIDATION_PENDING_KEY];
        if (!(pending instanceof Set)) {
            return;
        }

        delete event.queryRunner.data[CACHE_INVALIDATION_PENDING_KEY];

        await this.invalidate(Array.from(pending as Set<string>));
    }

    // ----------------------------------------------------

    protected async collect(queryRunner: QueryRunner, tags: string[]) : Promise<void> {
        if (tags.length === 0) {
            return;
        }

        if (!queryRunner.isTransactionActive) {
            await this.invalidate(Array.from(new Set(tags)));
            return;
        }

        let pending = queryRunner.data[CACHE_INVALIDATION_PENDING_KEY];
        if (!(pending instanceof Set)) {
            pending = new Set<string>();
            queryRunner.data[CACHE_INVALIDATION_PENDING_KEY] = pending;
        }

        for (const tag of tags) {
            pending.add(tag);
        }
    }

    protected async invalidate(tags: string[]) : Promise<void> {
        try {
            await this.cache.invalidate(tags);
        } catch (e) {
            this.onError(e);
        }
    }

    /**
     * The tags one written row of an entity bumps: the collection always
     * (a rename can move a row into a name-keyed result), the record tag
     * when the row carries its primary key, a scoped tag per index-leading
     * column present on it. A pk-less payload (`Repository.update` hands
     * its values, `Repository.delete` nothing) yields the collection alone.
     */
    protected buildRowTags(metadata: EntityMetadata, row: ObjectLiteral | undefined) : string[] {
        const name = this.resolveSchemaName(metadata);
        if (typeof name === 'undefined') {
            return [];
        }

        const tags : string[] = [buildCollectionTag(name)];
        if (typeof row === 'undefined' || row === null) {
            return tags;
        }

        const id = this.readId(metadata, row);
        if (typeof id !== 'undefined') {
            tags.push(buildRecordTag(name, id));
        }

        const schema = this.resolveSchema(name);
        if (schema) {
            for (const column of leadingColumns(schema)) {
                const value = row[column];
                if (typeof value !== 'undefined' && isScopedTagValue(value)) {
                    tags.push(buildScopedTag(name, column, value));
                }
            }
        }

        return tags;
    }

    /**
     * A many-to-many link or unlink writes the junction table alone, and
     * TypeORM fires the hook on the junction metadata only: neither side's
     * row is written. A reader that included the relation carries the
     * collection tag of the other side (and one of its own side, when it
     * started from the inverse), so both collections are bumped. When the
     * payload carries the join values (a repository `save`, and
     * `RelationQueryBuilder.add`) the two record tags are bumped as well;
     * `RelationQueryBuilder.remove` hands nothing, which leaves the two
     * collections.
     */
    protected buildJunctionTags(metadata: EntityMetadata, row: ObjectLiteral | undefined) : string[] {
        if (!metadata.isJunction) {
            return [];
        }

        const tags : string[] = [];

        for (const columns of [metadata.ownerColumns, metadata.inverseColumns]) {
            const target = columns[0]?.referencedColumn?.entityMetadata;
            if (!target) {
                continue;
            }

            const name = this.resolveSchemaName(target);
            if (typeof name === 'undefined') {
                continue;
            }

            tags.push(buildCollectionTag(name));

            if (typeof row === 'undefined' || row === null) {
                continue;
            }

            const reference : ObjectLiteral = {};
            for (const column of columns) {
                if (column.referencedColumn) {
                    reference[column.referencedColumn.propertyName] = row[column.propertyName];
                }
            }

            const id = this.readId(target, reference);
            if (typeof id !== 'undefined') {
                tags.push(buildRecordTag(name, id));
            }
        }

        return tags;
    }

    /**
     * Child rows the database changes on a delete fire no hook, so their
     * collections are bumped from the parent's removal, plus the scoped tag
     * of the join column where it leads an index on a direct child (the
     * value is the removed parent's key, which the row in hand carries).
     */
    protected buildCascadeTags(
        metadatas: EntityMetadata[],
        metadata: EntityMetadata,
        row: ObjectLiteral | undefined,
    ) : string[] {
        const tags = new Set<string>();

        for (const dependency of this.resolveCascades(metadatas, metadata)) {
            tags.add(buildCollectionTag(dependency.schema));

            if (typeof row === 'undefined' || row === null) {
                continue;
            }

            for (const column of dependency.columns) {
                const value = row[column.parent];
                if (typeof value !== 'undefined' && isScopedTagValue(value)) {
                    tags.add(buildScopedTag(dependency.schema, column.child, value));
                }
            }
        }

        return Array.from(tags);
    }

    /**
     * Every entity the database changes when a row of `metadata` goes,
     * transitively: a CASCADE-deleted child's own CASCADE and SET NULL
     * children change too, so the walk recurses through CASCADE edges. A
     * SET NULL edge ends it, since the child survives and changes nothing
     * below itself. An untracked entity on the way is walked through all the
     * same. Only a direct child gets join columns: deeper down, the value
     * the join column held is not in hand, so a deeper child is reached
     * through its collection alone.
     */
    protected resolveCascades(metadatas: EntityMetadata[], metadata: EntityMetadata) : CascadeDependency[] {
        let dependencies = this.cascades.get(metadata);
        if (dependencies) {
            return dependencies;
        }

        const output : CascadeDependency[] = [];
        const visited = new Set<EntityMetadata>([metadata]);

        const walk = (parent: EntityMetadata, direct: boolean) => {
            for (const candidate of metadatas) {
                for (const relation of candidate.relations) {
                    if (
                        relation.inverseEntityMetadata !== parent ||
                        (relation.onDelete !== 'CASCADE' && relation.onDelete !== 'SET NULL')
                    ) {
                        continue;
                    }

                    const schema = this.resolveSchemaName(relation.entityMetadata);
                    if (typeof schema !== 'undefined') {
                        output.push({
                            schema,
                            columns: direct ? this.resolveCascadeColumns(schema, relation) : [],
                        });
                    }

                    if (
                        relation.onDelete === 'CASCADE' &&
                        !visited.has(relation.entityMetadata)
                    ) {
                        visited.add(relation.entityMetadata);
                        walk(relation.entityMetadata, false);
                    }
                }
            }
        };

        walk(metadata, true);

        dependencies = output;
        this.cascades.set(metadata, dependencies);

        return dependencies;
    }

    protected resolveCascadeColumns(schema: string, relation: RelationMetadata) : CascadeColumn[] {
        const leading = new Set<string>();
        const target = this.resolveSchema(schema);
        if (target) {
            for (const column of leadingColumns(target)) {
                leading.add(column);
            }
        }

        const columns : CascadeColumn[] = [];
        for (const joinColumn of relation.joinColumns) {
            if (
                joinColumn.referencedColumn &&
                leading.has(joinColumn.propertyName)
            ) {
                columns.push({
                    child: joinColumn.propertyName,
                    parent: joinColumn.referencedColumn.propertyName,
                });
            }
        }

        return columns;
    }

    /**
     * The row's primary key as one tag value: a composite key joins its
     * values with `:`.
     */
    protected readId(metadata: EntityMetadata, row: ObjectLiteral) : string | undefined {
        const idMap = metadata.getEntityIdMap(row);
        if (typeof idMap === 'undefined') {
            return undefined;
        }

        const values : string[] = [];
        for (const column of metadata.primaryColumns) {
            const value = column.getEntityValue(idMap);
            if (typeof value === 'undefined' || value === null) {
                return undefined;
            }

            values.push(String(value));
        }

        return values.join(':');
    }

    /**
     * A schema the registry lacks is reported rather than thrown: the
     * reading side throws for it already, and a hook must not fail a write.
     */
    protected resolveSchema(name: string) : Schema | undefined {
        const schema = this.registry.get(name);
        if (typeof schema === 'undefined') {
            this.onError(CacheError.schemaUnresolvable(name));
        }

        return schema;
    }
}

type CascadeColumn = {
    /**
     * The join column property on the child row.
     */
    child: string,
    /**
     * The referenced column property on the removed parent row.
     */
    parent: string,
};

type CascadeDependency = {
    schema: string,
    columns: CascadeColumn[],
};

function leadingColumns(schema: Schema) : string[] {
    return Array.from(new Set(schema.indexes
        .map((index) => index[0])
        .filter((column) : column is string => typeof column === 'string')));
}
