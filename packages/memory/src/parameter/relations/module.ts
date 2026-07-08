/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IRelation,
    IRelationVisitor,
    IRelations,
    IRelationsVisitor,
} from '@rapiq/core';

export class RelationsVisitor implements IRelationsVisitor<string[]>, IRelationVisitor<string> {
    visitRelations(expr: IRelations) : string[] {
        return expr.value.map((relation) => relation.accept<string>(this));
    }

    visitRelation(expr: IRelation) : string {
        return expr.name;
    }
}
