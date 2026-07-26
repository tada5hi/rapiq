/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Datamodel } from '../../src';

const scalar = (name: string, type: string, isRequired = true) => ({
    name,
    kind: 'scalar',
    isList: false,
    isRequired,
    type,
});

const relation = (name: string, type: string, isList: boolean, isRequired = true) => ({
    name,
    kind: 'object',
    isList,
    isRequired,
    type,
});

/**
 * Shaped exactly like `Prisma.dmmf.datamodel` so the fixture doubles
 * as a check that a real datamodel is assignable.
 */
export const datamodel : Datamodel = {
    models: [
        {
            name: 'User',
            fields: [
                scalar('id', 'Int'),
                scalar('first_name', 'String'),
                scalar('last_name', 'String'),
                scalar('email', 'String'),
                scalar('age', 'Int'),
                scalar('address', 'String', false),
                scalar('realm_id', 'Int', false),
                relation('realm', 'Realm', false, false),
                relation('items', 'Item', true),
            ],
        },
        {
            name: 'Realm',
            fields: [
                scalar('id', 'Int'),
                scalar('name', 'String'),
                scalar('description', 'String', false),
            ],
        },
        {
            name: 'Item',
            fields: [
                scalar('id', 'Int'),
                scalar('title', 'String'),
                scalar('color', 'String', false),
            ],
        },
    ],
};
