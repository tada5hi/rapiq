/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { BaseSchemaOptions, VerifyFn } from '../../types';
import type { ObjectLiteral, SimpleKeys } from '../../../types';

export type FieldsOptions<
    T extends Record<string, any> = Record<string, any>,
    CONTEXT extends ObjectLiteral = ObjectLiteral,
> = BaseSchemaOptions & {
    mapping?: Record<string, string>,
    allowed?: SimpleKeys<T>[],
    default?: SimpleKeys<T>[],
    verify?: VerifyFn<string[], CONTEXT>
};
