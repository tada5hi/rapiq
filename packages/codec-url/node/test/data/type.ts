/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
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

export type AuditEvent = {
    id: string,
    realmId: string | null,
    scope: string,
    name: string,
    createdAt: Date,
};

export type Order = {
    id: string,
    status: string,
    couponId: string | null,
    amount: number,
    fee: number,
    createdAt: Date,
};
