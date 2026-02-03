/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IRelation } from '../record';

export interface IRelationsVisitor<R> {
    visitRelations(expr: IRelations): R;
}

export interface IRelations {
    readonly value: IRelation[];

    accept<R>(visitor: IRelationsVisitor<R>) : R;

    extract(root: string): IRelations;
}
