/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IRelation, IRelationVisitor } from './types';

export class Relation implements IRelation {
    readonly name: string;

    constructor(name: string) {
        this.name = name;
    }

    accept<R>(visitor: IRelationVisitor<R>) : R {
        return visitor.visitRelation(this);
    }
}
