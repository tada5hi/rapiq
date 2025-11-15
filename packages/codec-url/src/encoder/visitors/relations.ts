/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IRelationVisitor, IRelationsVisitor,
    Relation,
    Relations,
} from 'rapiq';

import { URLParameter } from '../../constants';
import { ArraySerializer } from '../serializer';

export class RelationsVisitor implements IRelationsVisitor<ArraySerializer>,
IRelationVisitor<ArraySerializer> {
    protected serializer : ArraySerializer;

    constructor(serializer?: ArraySerializer) {
        this.serializer = serializer || new ArraySerializer(
            URLParameter.RELATIONS,
        );
    }

    visitRelations(expr: Relations): ArraySerializer {
        for (let i = 0; i < expr.value.length; i++) {
            expr.value[i].accept(this);
        }

        return this.serializer;
    }

    visitRelation(expr: Relation): ArraySerializer {
        this.serializer.add(expr.name);

        return this.serializer;
    }
}
