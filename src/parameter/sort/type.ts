/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Flatten, KeyWithOptionalPrefix, NestedKeys, OnlyObject, SimpleKeys,
} from '../../type';
import { RelationsParseOutput } from '../relations';
import {
    ParseAllowedKeys,
} from '../type';

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
// Parse
// -----------------------------------------------------------

export type SortParseOptionsDefault<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        SortParseOptionsDefault<Flatten<T[K]>> :
        `${SortDirection}`
} | {
    [K in NestedKeys<T>]?: `${SortDirection}`
};

export type SortParseOptions<
    T extends Record<string, any> = Record<string, any>,
    > = {
        allowed?: ParseAllowedKeys<T>,
        mapping?: Record<string, string>,
        default?: SortParseOptionsDefault<T>,
        defaultPath?: string,
        relations?: RelationsParseOutput,
    };
export type SortParseOutputElement = {
    key: string,
    value: `${SortDirection}`,
    path?: string
};
export type SortParseOutput = SortParseOutputElement[];
