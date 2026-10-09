/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Relation, Relations } from '../../src';

describe('src/parameter/relations', () => {
    it('should extract child relations', () => {
        const relations = new Relations([
            new Relation('items'),
            new Relation('items.realm'),
            new Relation('items.realm.owner'),
            new Relation('user'),
        ]);

        const children = relations.extract('items');

        expect(children.value).toEqual([
            new Relation('realm'),
            new Relation('realm.owner'),
        ]);
    });

    it('should not mutate the collection on extract', () => {
        const relations = new Relations([
            new Relation('items'),
            new Relation('items.realm'),
        ]);

        relations.extract('items');

        expect(relations.value).toHaveLength(2);
    });

    it('should not extract relations sharing a name prefix', () => {
        const relations = new Relations([
            new Relation('item'),
            new Relation('items.realm'),
        ]);

        const children = relations.extract('item');

        expect(children.value).toHaveLength(0);
    });
});
