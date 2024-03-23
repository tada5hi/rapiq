/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Flatten, NestedKeys, ObjectLiteral, OnlyObject, SimpleKeys,
} from '../type';

// -----------------------------------------------------------

type ParseAllowedObjectOption<
    T extends ObjectLiteral = ObjectLiteral,
> = {
    [K in keyof T]?: T[K] extends OnlyObject<T[K]> ?
        ParseAllowedOption<Flatten<T[K]>> :
        never
};

export type ParseAllowedOption<T> = T extends ObjectLiteral ?
    (
        ParseAllowedObjectOption<T>
        |
        (
            SimpleKeys<T>[] |
            ParseAllowedObjectOption<T>
        )[]
        |
        NestedKeys<T>[]
    ) : string[];
