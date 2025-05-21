/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldOperator } from '../../../schema';
import type {
    Flatten, KeyWithOptionalPrefix, NestedKeys, ObjectLiteral, OnlyObject, SimpleKeys,
} from '../../../types';

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
