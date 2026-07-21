/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    SimpleKeys,
} from '../../../types';
import type { SortDirection } from './constants';
import type { BaseSchemaOptions, KeyValidator } from '../../types';

export type SortOptionDefault<T extends Record<string, any>> = {
    [K in SimpleKeys<T>]?: `${SortDirection}`
};

export type SortOptions<
    T extends Record<string, any> = Record<string, any>,
    CONTEXT = any,
> = BaseSchemaOptions & {
    allowed?: SimpleKeys<T>[] | SimpleKeys<T>[][],
    mapping?: Record<string, string>,
    default?: SortOptionDefault<T>,
    /**
     * Dynamic per-sort-key gate, e.g. an actor permission check.
     * Runs once per client-requested sort key against the schema that
     * governs it (the target schema for dotted keys), after tuple-group
     * matching. Schema defaults bypass the hook.
     */
    validate?: KeyValidator<CONTEXT>,
};
