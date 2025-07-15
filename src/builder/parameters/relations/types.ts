/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ArrayItem, NestedResourceKeys, OnlyObject } from '../../../types';

export type RelationsBuildInput<T extends Record<PropertyKey, any>> = {
    [K in keyof T]?: ArrayItem<T[K]> extends OnlyObject<T[K]> ?
        RelationsBuildInput<ArrayItem<T[K]>> | boolean :
        never
} |
NestedResourceKeys<T>[] |
NestedResourceKeys<T>;
