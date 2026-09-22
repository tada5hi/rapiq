/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IGroup } from '../record';

export interface IGroupsVisitor<R> {
    visitGroups(expr: IGroups): R;
}

export interface IGroups {
    readonly value: IGroup[];

    accept<R>(visitor: IGroupsVisitor<R>) : R;

    merge(other: IGroups): IGroups;
}
