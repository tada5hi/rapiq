/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type Realm = {
    id: string,
    name: string,
};

export type Role = {
    id: string,
    name: string,
    realmId: string,
    realm: Realm,
};

export type User = {
    id: string,
    name: string,
};

export type UserRole = {
    id: string,
    userId: string,
    roleId: string,
    user?: User,
    role?: Role,
};

export type Tag = {
    id: string,
    name: string,
    articles?: Article[],
};

export type Article = {
    id: string,
    title: string,
    tags?: Tag[],
};

export type Note = {
    id: string,
    realmId: string | null,
};
