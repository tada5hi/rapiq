/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type Event = {
    id: number,
    realmId: string | null,
    scope: string | null,
    name: string,
    amount: number | null,
    createdAt: Date | string | null,
};

/**
 * Instants chosen around UTC boundaries: id 1 is the last millisecond of
 * a UTC day, id 4 carries an offset that lands inside the UTC day, and
 * id 6 is September locally but August in UTC, which a host-zone
 * truncation would misplace.
 */
export const events : Event[] = [
    {
        id: 1,
        realmId: 'r1',
        scope: 'user',
        name: 'login',
        amount: 10,
        createdAt: new Date('2026-09-21T23:59:59.999Z'),
    },
    {
        id: 2,
        realmId: 'r1',
        scope: 'user',
        name: 'login',
        amount: 5,
        createdAt: new Date('2026-09-22T00:00:00.000Z'),
    },
    {
        id: 3,
        realmId: 'r1',
        scope: 'user',
        name: 'logout',
        amount: null,
        createdAt: '2026-09-22T10:30:00.000Z',
    },
    {
        id: 4,
        realmId: 'r1',
        scope: 'client',
        name: 'login',
        amount: 2.5,
        createdAt: '2026-09-22T12:00:00+02:00',
    },
    {
        id: 5,
        realmId: null,
        scope: null,
        name: 'login',
        amount: 7,
        createdAt: null,
    },
    {
        id: 6,
        realmId: 'r2',
        scope: 'User',
        name: 'login',
        amount: 1,
        createdAt: '2026-09-01T01:00:00+02:00',
    },
];
