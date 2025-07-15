/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SortDirection } from '../../../schema';
import type {
    ArrayItem, KeyWithOptionalPrefix, NestedKeys, OnlyObject, SimpleKeys,
} from '../../../types';

type SortWithOperator<T extends string> = KeyWithOptionalPrefix<T, '-'>;

export type SortBuildInput<T extends Record<string, any>> =
    {
        [K in keyof T]?: ArrayItem<T[K]> extends OnlyObject<T[K]> ?
            SortBuildInput<ArrayItem<T[K]>> :
        `${SortDirection}`
    }
    |
    [
        SortWithOperator<SimpleKeys<T>>[],
        {
            [K in keyof T]?: ArrayItem<T[K]> extends OnlyObject<T[K]> ?
                SortBuildInput<ArrayItem<T[K]>> :
            `${SortDirection}`
        },
    ]
    |
    SortWithOperator<NestedKeys<T>>[] |
    SortWithOperator<NestedKeys<T>>;
