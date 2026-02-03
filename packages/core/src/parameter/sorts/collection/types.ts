/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ISort } from '../record';

export interface ISortsVisitor<R> {
    visitSorts(expr: ISorts): R;
}

export interface ISorts {
    readonly value: ISort[];

    accept<R>(visitor: ISortsVisitor<R>) : R;
}
