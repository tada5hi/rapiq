/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Flatten, KeyWithOptionalPrefix, NestedKeys, OnlyObject, SimpleKeys,
} from '../../types';
import type { OptionAllowed } from '../../utils';

export enum SortDirection {
    ASC = 'ASC',
    DESC = 'DESC',
}

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

type SortWithOperator<T extends string> = KeyWithOptionalPrefix<T, '-'>;

export type SortBuildInput<T extends Record<string, any>> =
    {
        [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
            SortBuildInput<Flatten<T[K]>> :
            `${SortDirection}`
    }
    |
    (
        SortWithOperator<SimpleKeys<T>>[] |
        {
            [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
                SortBuildInput<Flatten<T[K]>> :
                `${SortDirection}`
        }
    )[]
    |
    SortWithOperator<NestedKeys<T>>[] |
    SortWithOperator<NestedKeys<T>>;

// -----------------------------------------------------------

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
