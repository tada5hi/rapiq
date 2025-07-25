/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldOperator } from '../../../schema';
import type {
    ArrayItem, KeyWithOptionalPrefix, NestedKeys, ObjectLiteral, OnlyObject, SimpleKeys,
} from '../../../types';

type FieldWithOperator<T extends string> = KeyWithOptionalPrefix<T, FieldOperator>;

export type FieldsBuildSimpleKeyInput<T extends ObjectLiteral = ObjectLiteral> = FieldWithOperator<SimpleKeys<T>>;
export type FieldsBuildNestedKeyInput<T extends ObjectLiteral = ObjectLiteral> = FieldWithOperator<NestedKeys<T>>;

export type FieldsBuildRecordInput<T extends ObjectLiteral = ObjectLiteral> = {
    [K in keyof T]?: ArrayItem<T[K]> extends OnlyObject<T[K]> ?
        FieldsBuildInput<ArrayItem<T[K]>> :
        never
};

export type FieldsBuildTupleInput<T extends ObjectLiteral = ObjectLiteral> = [
    FieldsBuildSimpleKeyInput<T>[],
    FieldsBuildRecordInput<T>,
];

export type FieldsBuildInput<T extends ObjectLiteral> = FieldsBuildRecordInput<T> |
FieldsBuildTupleInput<T> |
FieldsBuildNestedKeyInput<T>[] |
FieldsBuildNestedKeyInput<T>;
