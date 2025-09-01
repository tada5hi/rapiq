/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { BaseSchemaOptions } from '../../types';
import type { ObjectLiteral, ObjectLiteralKeys, SimpleKeys } from '../../../types';
import type { FieldsHookName } from './constants';

export type FieldsOptions<
    T extends Record<string, any> = Record<string, any>,
> = BaseSchemaOptions & {
    mapping?: Record<string, string>,
    allowed?: SimpleKeys<T>[],
    default?: SimpleKeys<T>[]
};

export type FieldsHooks = ObjectLiteralKeys<{
    [FieldsHookName.PARSE_NORMALIZED]: (
        value: Record<string, string[]>,
        context: ObjectLiteral
    ) => Promise<void> | void;

    [FieldsHookName.PARSE_AFTER]: (
        value: string[],
        context: ObjectLiteral
    ) => Promise<void> | void,

    [FieldsHookName.PARSE_RELATIONS]: (
        value: string[],
        context: ObjectLiteral
    ) => Promise<void> | void,
}>;
