/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IRelationVisitor, 
    IRelationsVisitor, 
    Relation, 
    Relations,
} from '@rapiq/core';
import type { IRelationsAdapter } from '../adapter';
import type { VisitorOptions } from './types';

export type RelationsInterpreterOptions = VisitorOptions;

/**
 * @deprecated use {@link RelationsInterpreterOptions}. Removed in 3.0.
 */
export type RelationInterpreterOptions = RelationsInterpreterOptions;

export class RelationsVisitor implements IRelationsVisitor<IRelationsAdapter>,
IRelationVisitor<IRelationsAdapter> {
    protected adapter: IRelationsAdapter;

    protected options: RelationsInterpreterOptions = {};

    constructor(
        adapter: IRelationsAdapter,
        options: RelationsInterpreterOptions = {},
    ) {
        this.adapter = adapter;
        this.options = options;
    }

    visitRelation(expr: Relation): IRelationsAdapter {
        this.adapter.add(expr.name, { include: true });

        return this.adapter;
    }

    visitRelations(expr: Relations): IRelationsAdapter {
        for (const item of expr.value) {
            item.accept(this);
        }

        return this.adapter;
    }
}
