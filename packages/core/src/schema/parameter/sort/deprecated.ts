import type { ObjectLiteral } from '../../../types';
/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */


import { defineSortsSchema } from './define';
import { SortsSchema } from './schema';


/**
 * @deprecated use {@link SortsSchema}. Removed in 3.0.
 */
export const SortSchema = SortsSchema;

/**
 * @deprecated use {@link defineSortsSchema}. Removed in 3.0.
 */
export const defineSortSchema = defineSortsSchema;

// eslint-disable-next-line @tada5hi/type-declaration-location -- Preserve the merged public value and type alias.
export type SortSchema<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> = SortsSchema<T, CONTEXT>;
