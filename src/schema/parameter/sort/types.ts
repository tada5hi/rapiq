/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Flatten, NestedKeys, OnlyObject } from '../../../types';
import type { OptionAllowed } from '../../../utils';
import type { SortDirection } from './constants';

export type SortOptionDefault<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        SortOptionDefault<Flatten<T[K]>> :
        `${SortDirection}`
} | {
    [K in NestedKeys<T>]?: `${SortDirection}`
};

export type SortOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    allowed?: OptionAllowed<T>,
    mapping?: Record<string, string>,
    default?: SortOptionDefault<T>,
    defaultPath?: string,
    throwOnFailure?: boolean,
};
