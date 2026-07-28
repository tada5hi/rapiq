/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FieldsAdapter,
    FiltersAdapter,
    RelationsAdapter,
    SortAdapter,
    pg,
} from '../../../src';

/**
 * A backend-aware relations adapter: only `role` (and chains through it)
 * are real relations — `profile` is an embedded column prefix.
 */
class EmbeddedAwareRelationsAdapter extends RelationsAdapter {
    override isRelationPath(path: string) : boolean {
        return path === 'role' || path === 'role.realm';
    }
}

describe('src/adapter (relation-path hook)', () => {
    it('should register every dotted prefix as a relation by default', () => {
        const relations = new RelationsAdapter();
        const filters = new FiltersAdapter(relations, { ...pg, rootAlias: 'user' });

        filters.where('profile.firstName', '=', 'x');

        expect(filters.getQuery()).toEqual('"r7_profile"."firstName" = $1');
        expect(relations.getPaths()).toEqual(['profile']);
    });

    it('should render a non-relation dotted path against the root alias', () => {
        const relations = new EmbeddedAwareRelationsAdapter();
        const filters = new FiltersAdapter(relations, { ...pg, rootAlias: 'user' });

        filters.where('profile.firstName', '=', 'x');

        expect(filters.getQuery()).toEqual('"user"."profile.firstName" = $1');
        expect(relations.getPaths()).toEqual([]);
    });

    it('should split a mixed path at the relation boundary', () => {
        const relations = new EmbeddedAwareRelationsAdapter();
        const filters = new FiltersAdapter(relations, { ...pg, rootAlias: 'user' });

        filters.where('role.profile.firstName', '=', 'x');

        expect(filters.getQuery()).toEqual('"r4_role"."profile.firstName" = $1');
        expect(relations.getPaths()).toEqual(['role']);
    });

    it('should keep joining real relation chains', () => {
        const relations = new EmbeddedAwareRelationsAdapter();
        const filters = new FiltersAdapter(relations, { ...pg, rootAlias: 'user' });

        filters.where('role.realm.name', '=', 'x');

        expect(filters.getQuery()).toEqual('"r4_role_5_realm"."name" = $1');
        expect(relations.getPaths()).toEqual(['role', 'role.realm']);
    });

    it('should route sort keys through the hook', () => {
        const relations = new EmbeddedAwareRelationsAdapter();
        const sort = new SortAdapter(relations, {
            escapeField: pg.escapeField,
            rootAlias: 'user',
        });

        sort.add('profile.firstName', 'ASC');
        sort.add('role.name', 'DESC');

        expect(sort.getOrderBy()).toEqual([
            '"user"."profile.firstName" ASC',
            '"r4_role"."name" DESC',
        ]);
        expect(relations.getPaths()).toEqual(['role']);
    });

    it('should route selection fields through the hook', () => {
        const relations = new EmbeddedAwareRelationsAdapter();
        const fields = new FieldsAdapter(relations, {
            escapeField: pg.escapeField,
            rootAlias: 'user',
        });

        fields.add('profile.firstName');
        fields.add('role.name');

        expect(fields.getColumns()).toEqual([
            '"user"."profile.firstName"',
            '"r4_role"."name"',
        ]);
        expect(relations.getPaths()).toEqual(['role']);
    });
});
