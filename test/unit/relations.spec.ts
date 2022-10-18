/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { RelationsParseOutput, parseQueryRelations } from '../../src';

describe('src/relations/index.ts', () => {
    it('should transform request relations', () => {
        // single data matching
        let allowed = parseQueryRelations('profile', { allowed: ['profile'] });
        expect(allowed).toEqual([
            { key: 'profile', value: 'profile' },
        ] as RelationsParseOutput);

        allowed = parseQueryRelations([], { allowed: ['profile'] });
        expect(allowed).toEqual([]);

        // with alias
        allowed = parseQueryRelations('pro', { mapping: { pro: 'profile' }, allowed: ['profile'] });
        expect(allowed).toEqual([
            { key: 'profile', value: 'profile' },
        ]);

        // with nested alias
        allowed = parseQueryRelations(['abc.photos'], {
            allowed: ['profile.photos'],
            mapping: { 'abc.photos': 'profile.photos' },
        });
        expect(allowed).toEqual([
            { key: 'profile', value: 'profile' },
            { key: 'profile.photos', value: 'photos' },
        ] as RelationsParseOutput);

        // with nested alias & includeParents
        allowed = parseQueryRelations(['abc.photos'], {
            allowed: ['profile.photos'],
            mapping: { 'abc.photos': 'profile.photos' },
            includeParents: false,
        });
        expect(allowed).toEqual([
            { key: 'profile.photos', value: 'photos' },
        ] as RelationsParseOutput);

        // with nested alias & limited includeParents ( no user_roles rel)
        allowed = parseQueryRelations(['abc.photos', 'user_roles.role'], {
            allowed: ['profile.photos', 'user_roles.role'],
            mapping: { 'abc.photos': 'profile.photos' },
            includeParents: ['profile.**'],
        });
        expect(allowed).toEqual([
            { key: 'profile', value: 'profile' },
            { key: 'profile.photos', value: 'photos' },
            { key: 'user_roles.role', value: 'role' },
        ] as RelationsParseOutput);

        // multiple data matching
        allowed = parseQueryRelations(['profile', 'abc'], { allowed: ['profile'] });
        expect(allowed).toEqual([{ key: 'profile', value: 'profile' }] as RelationsParseOutput);

        // no allowed
        allowed = parseQueryRelations(['profile'], { allowed: [] });
        expect(allowed).toEqual([] as RelationsParseOutput);

        // no allowed
        allowed = parseQueryRelations(['profile'], { allowed: undefined });
        expect(allowed).toEqual([] as RelationsParseOutput);

        // nested data with alias
        allowed = parseQueryRelations(['profile.photos', 'profile.photos.abc', 'profile.abc'], { allowed: ['profile.photos'] });
        expect(allowed).toEqual([
            { key: 'profile', value: 'profile' },
            { key: 'profile.photos', value: 'photos' },
        ] as RelationsParseOutput);

        // nested data with alias
        allowed = parseQueryRelations(['profile.photos', 'profile.photos.abc', 'profile.abc'], { allowed: ['profile.photos**'] });
        expect(allowed).toEqual([
            { key: 'profile', value: 'profile' },
            { key: 'profile.photos', value: 'photos' },
            { key: 'profile.photos.abc', value: 'abc' },
        ] as RelationsParseOutput);

        // null data
        allowed = parseQueryRelations(null);
        expect(allowed).toEqual([]);
    });
});
