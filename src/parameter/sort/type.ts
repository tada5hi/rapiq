/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Flatten, KeyWithOptionalPrefix, NestedKeys, OnlyObject, SimpleKeys,
} from '../../type';
import type { RelationsParseOutput } from '../relations';
import type {
    ParseAllowedOption,
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

export type SortParseDefaultOption<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        SortParseDefaultOption<Flatten<T[K]>> :
        `${SortDirection}`
} | {
    [K in NestedKeys<T>]?: `${SortDirection}`
};

export type SortParseOptions<
    T extends Record<string, any> = Record<string, any>,
    > = {
        allowed?: ParseAllowedOption<T>,
        mapping?: Record<string, string>,
        default?: SortParseDefaultOption<T>,
        defaultPath?: string,
        throwOnError?: boolean,
        relations?: RelationsParseOutput,
    };
export type SortParseOutputElement = {
    key: string,
    value: `${SortDirection}`,
    path?: string
};
export type SortParseOutput = SortParseOutputElement[];
