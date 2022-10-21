/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Flatten, NestedKeys, ObjectLiteral, OnlyObject, SimpleKeys,
} from '../type';

// -----------------------------------------------------------

type ParseAllowedObject<T extends ObjectLiteral = ObjectLiteral> = {
    [K in keyof T]?: T[K] extends OnlyObject<T[K]> ?
        ParseAllowedKeys<Flatten<T[K]>> :
        never
};

export type ParseAllowedKeys<T extends ObjectLiteral = ObjectLiteral> = T extends ObjectLiteral ?
    (
        ParseAllowedObject<T> |
        (
            SimpleKeys<T>[] |
            ParseAllowedObject<T>
        )[]
        |
        NestedKeys<T>[]
    ) : string[];
