/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { RelationsBaseAdapter, splitFirst } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';
import type { RelationsAdapterOptions } from './types';

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

    execute() : void {
        for (const relation of this.value) {
            if (relation.executed) {
                continue;
            }

            if (this.join(relation.path)) {
                relation.executed = true;
            }
        }
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
                this.applyJoin(`${parentAlias}.${relationName}`, alias);

                if (this.options.onJoin) {
                    this.options.onJoin(path, alias, this.queryBuilder);
                }
            }

            meta = relation.inverseEntityMetadata;
            parentAlias = alias;
        }

        return true;
    }

    protected applyJoin(property: string, alias: string) : void {
        const inner = this.options.joinType === 'inner';

        if (this.options.joinAndSelect) {
            if (inner) {
                this.queryBuilder.innerJoinAndSelect(property, alias);
            } else {
                this.queryBuilder.leftJoinAndSelect(property, alias);
            }
        } else if (inner) {
            this.queryBuilder.innerJoin(property, alias);
        } else {
            this.queryBuilder.leftJoin(property, alias);
        }
    }
}
