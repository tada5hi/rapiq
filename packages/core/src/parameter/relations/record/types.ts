/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export interface IRelationVisitor<R> {
    visitRelation(expr: IRelation): R;
}

export interface IRelation {
    readonly name: string;

    accept<R>(visitor: IRelationVisitor<R>) : R;
}
