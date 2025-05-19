/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Flatten, KeyWithOptionalPrefix, NestedKeys, ObjectLiteral, OnlyObject, SimpleKeys,
} from '../../types';
import type {
    ParseAllowedOption,
} from '../types';
import type { FieldOperator } from './constants';

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

type FieldWithOperator<T extends string> = KeyWithOptionalPrefix<T, FieldOperator>;

export type FieldsBuildSimpleKeyInput<T extends ObjectLiteral = ObjectLiteral> = FieldWithOperator<SimpleKeys<T>>;
export type FieldsBuildNestedKeyInput<T extends ObjectLiteral = ObjectLiteral> = FieldWithOperator<NestedKeys<T>>;
export type FieldsBuildRecordInput<T extends ObjectLiteral = ObjectLiteral> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        FieldsBuildInput<Flatten<T[K]>> :
        never
};

export type FieldsBuildInput<T extends ObjectLiteral> = FieldsBuildRecordInput<T> |
(FieldsBuildSimpleKeyInput[] | FieldsBuildRecordInput<T>)[] |
FieldsBuildNestedKeyInput[] |
FieldsBuildNestedKeyInput;

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------

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

// -----------------------------------------------------------

export type FieldsOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    mapping?: Record<string, string>,
    allowed?: ParseAllowedOption<T>,
    default?: ParseAllowedOption<T>,
    defaultPath?: string,
    throwOnFailure?: boolean,
};
