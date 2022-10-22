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
    ParseAllowedOption,
} from '../type';
import { FieldOperator } from './constants';

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

type FieldWithOperator<T extends string> = KeyWithOptionalPrefix<T, FieldOperator>;

export type FieldsBuildInput<T extends Record<string, any>> =
        {
            [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
                FieldsBuildInput<Flatten<T[K]>> :
                never
        }
        |
        (
            FieldWithOperator<SimpleKeys<T>>[]
            |
            {
                [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
                    FieldsBuildInput<Flatten<T[K]>> :
                    never
            }
        )[]
        |
        FieldWithOperator<NestedKeys<T>>[] |
        FieldWithOperator<NestedKeys<T>>;

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------

export type FieldsParseOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    mapping?: Record<string, string>,
    allowed?: ParseAllowedOption<T>,
    default?: ParseAllowedOption<T>,
    defaultPath?: string,
    relations?: RelationsParseOutput,
};

export type FieldsParseOutputElement = {
    key: string,
    path?: string,
    value?: string
};
export type FieldsParseOutput = FieldsParseOutputElement[];

export type FieldsInputTransformed = {
    default: string[],
    included: string[],
    excluded: string[]
};
