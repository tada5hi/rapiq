/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { RelationsBaseAdapter, splitFirst } from '@rapiq/sql';
import type { EntityMetadata, SelectQueryBuilder } from 'typeorm';
import type { RelationsAdapterOptions } from './types';

type RelationSelectMode = 'none' | 'full' | 'key';

export class RelationsAdapter extends RelationsBaseAdapter {
    protected queryBuilder : SelectQueryBuilder<any>;

    protected options : RelationsAdapterOptions;

    constructor(
        queryBuilder: SelectQueryBuilder<any>,
        options: RelationsAdapterOptions = {},
    ) {
        super(options);

        this.queryBuilder = queryBuilder;
        this.options = options;
    }

    /**
     * A dotted prefix only counts as a relation when every segment
     * resolves through the relation metadata — embedded column paths
     * (e.g. `profile.firstName` for `@Column(() => Profile)`) are dotted
     * too, but have nothing to join: they render against their parent
     * alias with the embedded column's database name instead.
     */
    override isRelationPath(path: string) : boolean {
        const { mainAlias } = this.queryBuilder.expressionMap;
        if (!mainAlias || !mainAlias.hasMetadata) {
            return super.isRelationPath(path);
        }

        let { metadata } = mainAlias;
        let rest : string | undefined = path;

        while (rest) {
            let segment : string;
            [segment, rest] = splitFirst(rest);

            const relation = metadata.findRelationWithPropertyPath(segment);
            if (!relation) {
                return false;
            }

            metadata = relation.inverseEntityMetadata;
        }

        return true;
    }

    override execute() : void {
        for (const relation of this.value) {
            if (relation.executed) {
                continue;
            }

            if (this.join(relation.path)) {
                relation.executed = true;
            }
        }
    }

    /**
     * Aliases of the relations `execute()` will join-*and-select* as a whole
     * subtree — i.e. `selectMode(path) === 'full'`. Such a relation contributes
     * every one of its columns through the join, so a field that also projects
     * into it is redundant, and re-selecting the column duplicates its output
     * alias, which MySQL rejects (#831). The fields adapter drops those columns.
     *
     * Deliberately keyed on `'full'`, not `shouldSelect`: an id-only `'key'`
     * relation is a plain `leftJoin` that does NOT auto-select its columns, so a
     * `<relation>.<column>` field there must stay in the explicit select.
     */
    fullySelectedRelationAliases() : Set<string> {
        const output = new Set<string>();

        for (const relation of this.value) {
            if (this.selectMode(relation.path) === 'full') {
                output.add(this.buildAlias(relation.path));
            }
        }

        return output;
    }

    protected join(input: string): boolean {
        let relationFullName : string | undefined = input;
        let path : string | undefined;
        let meta = this.queryBuilder.expressionMap.mainAlias!.metadata;
        let parentAlias = this.queryBuilder.alias;

        const { joinAttributes } = this.queryBuilder.expressionMap;

        while (relationFullName) {
            let relationName : string;
            [relationName, relationFullName] = splitFirst(relationFullName);

            path = path ?
                `${path}.${relationName}` :
                relationName;

            const relation = meta.findRelationWithPropertyPath(relationName);
            if (!relation) {
                return false;
            }

            const alias = this.buildAlias(path);

            const joined = joinAttributes.some(
                (joinAttribute) => joinAttribute.alias.name === alias,
            );

            if (!joined) {
                this.applyJoin(
                    `${parentAlias}.${relationName}`,
                    alias,
                    this.selectMode(path),
                    relation.inverseEntityMetadata,
                );

                if (this.options.onJoin) {
                    this.options.onJoin(path, alias, this.queryBuilder);
                }
            }

            meta = relation.inverseEntityMetadata;
            parentAlias = alias;
        }

        return true;
    }

    /**
     * Whether the joined relation's columns should be selected (hydrated).
     * An explicitly `include`d relation is always join-and-selected as a whole
     * subtree — a sparse `relation.column` field never narrows it, matching the
     * `@rapiq/memory` projection contract (#824). A relation joined purely for a
     * filter/sort (not `include`d) stays a plain `leftJoin`, so its columns are
     * selected only when a field references them.
     */
    protected shouldSelect(path: string): boolean {
        if (this.options.joinAndSelect) {
            return true;
        }

        const entry = this.value.find((join) => join.path === path);

        return !!entry && !!entry.include;
    }

    /**
     * Resolve how a joined relation is materialized: `'none'` (plain join,
     * unselected), `'full'` (whole subtree) or `'key'` (id-only). The
     * `hydrationMode` option narrows every *hydrated* relation to its primary
     * key so it survives `GROUP BY <root>.id` on strict dialects.
     */
    protected selectMode(path: string): RelationSelectMode {
        if (!this.shouldSelect(path)) {
            return 'none';
        }

        return this.options.hydrationMode === 'key' ? 'key' : 'full';
    }

    protected applyJoin(
        property: string,
        alias: string,
        mode: RelationSelectMode,
        target: EntityMetadata,
    ) : void {
        const inner = this.options.joinType === 'inner';

        if (mode === 'full') {
            if (inner) {
                this.queryBuilder.innerJoinAndSelect(property, alias);
            } else {
                this.queryBuilder.leftJoinAndSelect(property, alias);
            }

            return;
        }

        // 'none' (filter/sort-only) or 'key' (id-only hydration): a plain join.
        if (inner) {
            this.queryBuilder.innerJoin(property, alias);
        } else {
            this.queryBuilder.leftJoin(property, alias);
        }

        if (mode === 'key') {
            // Selecting the primary key alone hydrates the relation object
            // id-only (TypeORM's JoinAttribute.isSelected matches any selected
            // `<alias>.<column>`), which strict dialects accept under GROUP BY.
            // Guarded because relations run after fields: a `<relation>.<pk>`
            // field path (or a full `<alias>` select) already covers the key,
            // and re-adding it multiplies duplicate SELECT columns.
            const { selects } = this.queryBuilder.expressionMap;

            for (const column of target.primaryColumns) {
                const selection = `${alias}.${column.propertyPath}`;
                const selected = selects.some(
                    (select) => select.selection === selection || select.selection === alias,
                );

                if (!selected) {
                    this.queryBuilder.addSelect(selection);
                }
            }
        }
    }
}
