/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationsAdapterBaseOptions } from '@rapiq/sql';
import { RelationsBaseAdapter, splitFirst } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';

export class RelationsAdapter<
    QUERY extends SelectQueryBuilder<any> = SelectQueryBuilder<any>,
> extends RelationsBaseAdapter<QUERY> {
    protected options : RelationsAdapterBaseOptions;

    constructor(options: RelationsAdapterBaseOptions = {}) {
        super();

        this.options = options;
    }

    execute() : void {
        if (!this.query) {
            return;
        }

        // todo: mark items applied
        for (let i = 0; i < this.value.length; i++) {
            // todo: sub paths might already applied ...
            this.join(this.value[i].path);
        }
    }

    protected join(input: string): boolean {
        if (!this.query) {
            return false;
        }

        let relationFullName : string | undefined = input;
        let meta = this.query.expressionMap.mainAlias!.metadata;
        let { alias } = this.query;

        const { joinAttributes } = this.query.expressionMap;

        while (relationFullName) {
            let relationName : string;
            [relationName, relationFullName] = splitFirst(relationFullName);

            const relation = meta.findRelationWithPropertyPath(relationName);

            if (relation) {
                const joined = joinAttributes.findIndex(
                    (joinAttribute) => joinAttribute.alias.name === relationName,
                );

                if (joined === -1) {
                    if (this.options.joinAndSelect) {
                        this.query.innerJoinAndSelect(`${alias}.${relationName}`, relationName);
                    } else {
                        this.query.innerJoin(`${alias}.${relationName}`, relationName);
                    }
                }

                meta = relation.entityMetadata;
                alias = relationName;
            } else {
                return false;
            }
        }

        return true;
    }
}
