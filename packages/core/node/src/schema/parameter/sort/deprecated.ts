/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import { defineSortsSchema } from './define';
import { SortsSchema } from './schema';
import type {
    SortsOptionDefault,
    SortsOptions,
    SortsSchemaDescription,
} from './types';

/**
 * @deprecated use {@link SortsSchema}. Removed in 3.0.
 */
export const SortSchema = SortsSchema;

/**
 * @deprecated use {@link SortsSchema}. Removed in 3.0.
 */
export type SortSchema<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> = SortsSchema<T, CONTEXT>;

/**
 * @deprecated use {@link defineSortsSchema}. Removed in 3.0.
 */
export const defineSortSchema = defineSortsSchema;

/**
 * @deprecated use {@link SortsOptions}. Removed in 3.0.
 */
export type SortOptions<
    T extends Record<string, any> = Record<string, any>,
    CONTEXT = any,
> = SortsOptions<T, CONTEXT>;

/**
 * @deprecated use {@link SortsOptionDefault}. Removed in 3.0.
 */
export type SortOptionDefault<T extends Record<string, any>> = SortsOptionDefault<T>;

/**
 * @deprecated use {@link SortsSchemaDescription}. Removed in 3.0.
 */
export type SortSchemaDescription = SortsSchemaDescription;
