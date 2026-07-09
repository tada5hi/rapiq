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
    protected queryBuilder : SelectQueryBuilder<any> | undefined;

    protected options : RelationsAdapterOptions;

    constructor(
        queryBuilder: SelectQueryBuilder<any> | undefined,
        options: RelationsAdapterOptions = {},
    ) {
        super();

        this.queryBuilder = queryBuilder;
        this.options = options;
    }

    execute() : void {
        if (!this.queryBuilder) {
            return;
        }

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
        if (!this.queryBuilder) {
            return false;
        }

        let relationFullName : string | undefined = input;
        let path : string | undefined;
        let meta = this.queryBuilder.expressionMap.mainAlias!.metadata;
        let { alias } = this.queryBuilder;

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

            const joined = joinAttributes.some(
                (joinAttribute) => joinAttribute.alias.name === relationName,
            );

            if (!joined) {
                this.applyJoin(`${alias}.${relationName}`, relationName);

                if (this.options.onJoin) {
                    this.options.onJoin(path, relationName, this.queryBuilder);
                }
            }

            meta = relation.inverseEntityMetadata;
            alias = relationName;
        }

        return true;
    }

    protected applyJoin(property: string, alias: string) : void {
        if (!this.queryBuilder) {
            return;
        }

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
