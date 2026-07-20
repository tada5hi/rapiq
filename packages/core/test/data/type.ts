/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type Realm = {
    id: number,
    name: string,
    description: string,
};

export type Item = {
    id: string,
    name: string,
    realm: Realm,
    user: User
};

export type User = {
    id: string,
    name: string,
    email: string,
    age: number,
    realm: Realm,
    items: Item[]
};

export type Event = {
    id: string,
    data: Record<string, any> | null,
    meta: Record<string, string>,
    realm: Realm | null,
    user?: User,
    items: Item[] | null,
    created_at: Date,
};

// -----------------------------------------------------

// A relation target that carries a dynamic-attribute index signature
// (e.g. authup's `User`). It is a valid relation target — only its
// *expansion* must stop at the bag. See #789.
export type BagUser = {
    id: string,
    name: string,
    // dynamically loaded extra attributes
    [key: string]: any,
};

export type BagUserPermission = {
    id: string,
    user: BagUser,
    userId: string,
};

// -----------------------------------------------------

export type GrandChildEntity = {
    id: string,

    name: string
};

export type ChildEntity = {
    id: number;

    name: string;

    age: number;

    child: GrandChildEntity
};

export type Entity = {
    id: number,
    name: string,
    created_at: Date,
    child: ChildEntity,
    siblings: ChildEntity[]
};
