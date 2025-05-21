/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Flatten, NestedResourceKeys, OnlyObject } from '../../../types';

export type RelationsBuildInput<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        RelationsBuildInput<Flatten<T[K]>> | boolean :
        never
} | NestedResourceKeys<T>[];
