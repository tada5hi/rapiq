/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Field, fields } from '../../../src';
import type { Entity } from '../../data';

describe('src/builder/fields', () => {
    it('should build with simple input', async () => {
        const data = await fields<Entity>([
            'id',
            'name',
        ]);

        expect(data.value).toEqual([
            new Field('id'),
            new Field('name'),
        ]);
    });

    it('should build with tuple input', async () => {
        const data = await fields<Entity>([
            ['id', 'name'],
            {
                child: ['age'],
            },
        ]);

        expect(data.value).toEqual([
            new Field('id'),
            new Field('name'),
            new Field('child.age'),
        ]);
    });
});
