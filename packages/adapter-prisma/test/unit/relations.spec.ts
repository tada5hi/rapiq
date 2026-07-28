/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Relation, Relations } from '@rapiq/core';
import { collectRelationPaths } from '../../src';

describe('src/adapter/relations.ts', () => {
    it('should collect a dotted path with its parents', () => {
        expect(collectRelationPaths(new Relations([
            new Relation('items.realm'),
        ]))).toEqual(['items', 'items.realm']);
    });

    it('should collect a path only once', () => {
        expect(collectRelationPaths(new Relations([
            new Relation('items'),
            new Relation('items.realm'),
        ]))).toEqual(['items', 'items.realm']);
    });

    it('should collect nothing without relations', () => {
        expect(collectRelationPaths(new Relations())).toEqual([]);
    });
});
