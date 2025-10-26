/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IRelationVisitor, IRelationsVisitor, Relation, Relations,
} from 'rapiq';
import type { IRelationsAdapter } from '../adapter';
import type { VisitorOptions } from './types';

export type RelationInterpreterOptions = VisitorOptions;

export class RelationsVisitor implements IRelationsVisitor<IRelationsAdapter>,
IRelationVisitor<IRelationsAdapter> {
    protected adapter: IRelationsAdapter;

    protected options: RelationInterpreterOptions = {};

    constructor(
        adapter: IRelationsAdapter,
        options: RelationInterpreterOptions = {},
    ) {
        this.adapter = adapter;
        this.options = options;
    }

    visitRelation(expr: Relation): IRelationsAdapter {
        this.adapter.add(expr.name);

        return this.adapter;
    }

    visitRelations(expr: Relations): IRelationsAdapter {
        for (let i = 0; i < expr.value.length; i++) {
            expr.value[i].accept(this);
        }

        return this.adapter;
    }
}
