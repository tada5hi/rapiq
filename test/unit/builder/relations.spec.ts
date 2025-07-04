/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { relations } from '../../../src';
import type { Entity } from '../../data';

describe('src/builder/relations', () => {
    it('should build with simple input', () => {
        const data = relations<Entity>([
            'child',
            'child.child',
        ]);

        expect(data.value).toEqual(['child', 'child.child']);
    });

    it('should drop element', () => {
        const data = relations<Entity>();
        data.add('child');
        data.add('child.child');
        data.drop('child');

        expect(data.value).toEqual(['child.child']);
    });
});
