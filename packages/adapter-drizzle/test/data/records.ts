/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { User } from './type';

/**
 * The parity fixture: address is a value, NULL and another value;
 * realm is present, absent and present; items has one, zero and two
 * elements (one with a NULL column).
 */
export const records : User[] = [
    {
        id: 1,
        first_name: 'Caleb',
        last_name: 'Barrows',
        email: 'caleb.barrows@gmail.com',
        age: 18,
        address: 'Hogwarts',
        realm_id: 1,
        realm: {
            id: 1,
            name: 'master',
            description: null,
        },
        items: [{
            id: 1,
            title: 'book',
            color: 'red',
        }],
    },
    {
        id: 2,
        first_name: 'Aston',
        last_name: 'Nel',
        email: 'ashton.nel@gmail.com',
        age: 60,
        address: null,
        realm_id: null,
        realm: null,
        items: [],
    },
    {
        id: 3,
        first_name: 'Frodo',
        last_name: 'Baggins',
        email: 'frodo.baggins@gmail.com',
        age: 33,
        address: 'Mordor',
        realm_id: 2,
        realm: {
            id: 2,
            name: 'shire',
            description: 'the shire',
        },
        items: [
            {
                id: 2,
                title: 'ring',
                color: null,
            },
            {
                id: 3,
                title: 'book',
                color: 'blue',
            },
        ],
    },
];

/**
 * Satisfies `title = 'book'` and `color = 'red'` on DIFFERENT
 * elements: the same-element binding matrix depends on it not
 * matching the conjunction.
 */
export const splitRecord : User = {
    id: 9,
    first_name: 'Split',
    last_name: 'Case',
    email: 'split@case.io',
    age: 1,
    address: null,
    realm_id: null,
    realm: null,
    items: [
        {
            id: 90,
            title: 'book',
            color: 'blue',
        },
        {
            id: 91,
            title: 'ring',
            color: 'red',
        },
    ],
};
