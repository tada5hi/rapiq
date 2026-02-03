/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '../condition';

export interface IFiltersVisitor<R> {
    visitFilters(expr: IFilters): R;
}

export interface IFilters<
    T extends ICondition = ICondition,
> {
    readonly operator: string;

    readonly value : T[];

    accept<R>(visitor: IFiltersVisitor<R>) : R;

    add(child: T) : void;

    clear() : void;

    flatten(items?: T[]) : IFilters<T>;
}
