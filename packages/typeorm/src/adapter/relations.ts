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
    protected target : SelectQueryBuilder<any> | undefined;

    protected options : RelationsAdapterOptions;

    constructor(
        target: SelectQueryBuilder<any> | undefined,
        options: RelationsAdapterOptions = {},
    ) {
        super();

        this.target = target;
        this.options = options;
    }

    execute() : void {
        if (!this.target) {
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
        if (!this.target) {
            return false;
        }

        let relationFullName : string | undefined = input;
        let path : string | undefined;
        let meta = this.target.expressionMap.mainAlias!.metadata;
        let { alias } = this.target;

        const { joinAttributes } = this.target.expressionMap;

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
                    this.options.onJoin(path, relationName, this.target);
                }
            }

            meta = relation.inverseEntityMetadata;
            alias = relationName;
        }

        return true;
    }

    protected applyJoin(property: string, alias: string) : void {
        if (!this.target) {
            return;
        }

        const inner = this.options.joinType === 'inner';

        if (this.options.joinAndSelect) {
            if (inner) {
                this.target.innerJoinAndSelect(property, alias);
            } else {
                this.target.leftJoinAndSelect(property, alias);
            }
        } else if (inner) {
            this.target.innerJoin(property, alias);
        } else {
            this.target.leftJoin(property, alias);
        }
    }
}
