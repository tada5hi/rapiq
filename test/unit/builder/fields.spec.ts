/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID, fields } from '../../../src';
import type { Entity } from '../../data';

describe('src/builder/fields', () => {
    it('should build with simple input', () => {
        const data = fields<Entity>([
            'id',
            'name',
        ]);

        expect(data.value).toEqual({
            [DEFAULT_ID]: ['id', 'name'],
        });
    });

    it('should build with tuple input', () => {
        const data = fields<Entity>([
            ['id', 'name'],
            {
                child: ['age'],
            },
        ]);

        expect(data.value).toEqual({
            [DEFAULT_ID]: ['id', 'name'],
            child: ['age'],
        });
    });

    it('should build with multiple operations', () => {
        const data = fields<Entity>();
        data.add('id');
        data.add('child.age');

        expect(data.value).toEqual({
            [DEFAULT_ID]: ['id'],
            child: ['age'],
        });
    });
});
