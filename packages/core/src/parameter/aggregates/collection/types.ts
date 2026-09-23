/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IAggregate } from '../record';

export interface IAggregatesVisitor<R> {
    visitAggregates(expr: IAggregates): R;
}

export interface IAggregates {
    readonly value: IAggregate[];

    accept<R>(visitor: IAggregatesVisitor<R>) : R;

    merge(other: IAggregates): IAggregates;
}
