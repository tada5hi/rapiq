/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { NestedResourceKeys } from '../../../types';

export type RelationsOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    allowed?: NestedResourceKeys<T>[],
    includeParents?: boolean | string[] | string,
    // maps input name to local name
    mapping?: Record<string, string>,
    // set alternate value for relation key.
    pathMapping?: Record<string, string>,
    throwOnFailure?: boolean
};
