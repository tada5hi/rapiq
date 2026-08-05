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
    /**
     * A to-ONE nested under the to-many. Present on some elements and
     * absent on others, so a condition on it can only be satisfied per
     * element: the same-element binding contract.
     */
    realm_id: number | null,
    realm: Realm | null,
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
