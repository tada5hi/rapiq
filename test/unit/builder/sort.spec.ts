/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { sort } from '../../../src';
import type { Entity } from '../../data';

describe('src/builder/sort', () => {
    it('should build with simple input', () => {
        const data = sort<Entity>('-name');

        expect(data.value).toEqual({
            name: 'DESC',
        });
    });

    it('should set & unset element', () => {
        const data = sort<Entity>();
        data.set('id', 'ASC');
        data.set('name', 'ASC');
        data.set('child.age', 'DESC');

        data.unset('name');

        expect(data.value).toEqual({
            id: 'ASC',
            'child.age': 'DESC',
        });
    });
});
