/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { BaseSchemaOptions, KeyValidator } from '../../types';
import type { SimpleKeys } from '../../../types';

export type FieldsOptions<
    T extends Record<string, any> = Record<string, any>,
    CONTEXT = any,
> = BaseSchemaOptions & {
    mapping?: Record<string, string>,
    allowed?: SimpleKeys<T>[],
    default?: SimpleKeys<T>[],
    /**
     * Dynamic per-field gate, e.g. an actor permission check.
     * Runs once per client-requested field against the schema that
     * governs it (the target schema for dotted keys). Schema defaults
     * bypass the hook.
     */
    validate?: KeyValidator<CONTEXT>,
};
