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
}

export type Role = {
    id: string,
    realm: Realm
}

export type User = {
    id: string,
    name: string,
    email: string,
    realm: Realm,
    roles: Role[]
}
