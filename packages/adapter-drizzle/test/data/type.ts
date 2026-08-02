/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type Realm = {
    id: number,
    name: string,
    description: string | null,
};

export type Item = {
    id: number,
    title: string,
    color: string | null,
};

export type User = {
    id: number,
    first_name: string,
    last_name: string,
    email: string,
    age: number,
    address: string | null,
    realm_id: number | null,
    realm: Realm | null,
    items: Item[],
};
