/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IRelation } from '../record';
import { Relation } from '../record';
import type { IRelations, IRelationsVisitor } from './types';

export class Relations implements IRelations {
    readonly value: IRelation[];

    constructor(value: IRelation[] = []) {
        this.value = value;
    }

    accept<R>(visitor: IRelationsVisitor<R>) : R {
        return visitor.visitRelations(this);
    }

    /**
     * Collect the child relations below a given root
     * (e.g. root "items" yields "realm" for "items.realm").
     *
     * The collection itself is left untouched — parsers share one
     * relations instance across all parameters, so consuming entries
     * here would corrupt the parsed query.
     */
    extract(root: string): IRelations {
        const children: Relations = new Relations();

        const prefix = `${root}.`;
        for (let i = 0; i < this.value.length; i++) {
            if (this.value[i].name.substring(0, prefix.length) === prefix) {
                children.value.push(new Relation(this.value[i].name.substring(prefix.length)));
            }
        }

        return children;
    }
}
