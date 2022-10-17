/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Flatten, NestedKeys, OnlyObject, SimpleKeys,
} from '../type';

// -----------------------------------------------------------

export type ParseOptionsAllowedObject<T extends Record<string, any>> = {
    [K in keyof T]?: T[K] extends OnlyObject<T[K]> ?
        ParseOptionsAllowed<Flatten<T[K]>> :
        never
};

export type ParseOptionsAllowed<T extends Record<string, any>> = ParseOptionsAllowedObject<T> |
[
    SimpleKeys<T>[],
    ParseOptionsAllowedObject<T>,
]
|
NestedKeys<T>[];
