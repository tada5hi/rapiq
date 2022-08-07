/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../constants';
import {
    Flatten,
    KeyWithOptionalPrefix,
    OnlyObject,
    ParseOptionsBase,
    ParseOutputElementBase,
    ToOneAndMany,
} from '../type';
import { FieldOperator } from './constants';

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

type FieldWithOperator<T extends Record<string, any>> =
    KeyWithOptionalPrefix<keyof T, FieldOperator> |
    KeyWithOptionalPrefix<keyof T, FieldOperator>[];

export type FieldsBuildInput<T extends Record<string, any>> =
    {
        [K in keyof T]?: T[K] extends OnlyObject<T[K]> ?
            (FieldsBuildInput<Flatten<T[K]>> | FieldWithOperator<Flatten<T[K]>>) : never
    } |
    {
        [key: string]: ToOneAndMany<KeyWithOptionalPrefix<keyof T, FieldOperator>[]>,
    } |
    FieldWithOperator<T>;

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------

export type FieldsParseOptions = ParseOptionsBase<Parameter.FIELDS, Record<string, string[]> | string[]> & {
    default?: Record<string, string[]> | string[]
};

export type FieldsParseOutputElement = ParseOutputElementBase<Parameter.FIELDS, FieldOperator>;
export type FieldsParseOutput = FieldsParseOutputElement[];

export type FieldsInputTransformed = {
    default: string[],
    included: string[],
    excluded: string[]
};
