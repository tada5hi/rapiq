/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AbstractRelationsContainer, splitFirst } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';

export class RelationsContainer extends AbstractRelationsContainer<SelectQueryBuilder<any>> {
    join(input: string): boolean {
        if (!this.query) {
            return false;
        }

        let relationFullName : string | undefined = input;
        let meta = this.query.expressionMap.mainAlias!.metadata;
        let { alias } = this.query;

        while (relationFullName) {
            let relationName : string;
            [relationName, relationFullName] = splitFirst(relationFullName);

            const relation = meta.findRelationWithPropertyPath(relationName);
            if (relation) {
                this.query.innerJoin(`${alias}.${relationName}`, relationName);

                meta = relation.entityMetadata;
                alias = relationName;
            } else {
                return false;
            }
        }

        return true;
    }
}
