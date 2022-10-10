/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Flatten, KeyWithOptionalPrefix, OnlyObject, OnlyScalar, ParseOptionsBase, ParseOutputElementBase,
} from '../type';
import { Parameter } from '../../constants';

export enum SortDirection {
    ASC = 'ASC',
    DESC = 'DESC',
}

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

type SortWithOperator<T extends Record<string, any>> =
    KeyWithOptionalPrefix<keyof T, '-'> |
    KeyWithOptionalPrefix<keyof T, '-'>[];

export type SortBuildInput<T extends Record<string, any>> = {
    [K in keyof T]?: T[K] extends OnlyScalar<T[K]> ?
        `${SortDirection}` :
        T[K] extends Date ?
            `${SortDirection}` :
            T[K] extends OnlyObject<T[K]> ?
                SortBuildInput<Flatten<T[K]>> | SortWithOperator<Flatten<T[K]>> :
                never
} | SortWithOperator<T>;

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------
export type SortParseOptions = ParseOptionsBase<Parameter.SORT, string[] | string[][]>;
export type SortParseOutputElement = ParseOutputElementBase<Parameter.SORT, SortDirection>;
export type SortParseOutput = SortParseOutputElement[];
