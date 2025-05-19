/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {RelationsParseOutput, parseQueryRelations, RelationsOptions, RelationsParseError} from '../../src';

describe('src/relations/index.ts', () => {
    it('should parse simple relations', () => {
        let output = parseQueryRelations('profile', {allowed: ['profile']});
        expect(output).toEqual([
            {key: 'profile', value: 'profile'},
        ] as RelationsParseOutput);

        output = parseQueryRelations([], {allowed: ['profile']});
        expect(output).toEqual([]);

    })

    it('should parse with invalid path', () => {
        // invalid path
        let output = parseQueryRelations(['profile!']);
        expect(output).toEqual([]);

    })

    it('should parse ignore path pattern, if permitted by allowed key', () => {
        // ignore path pattern, if permitted by allowed key
        let output = parseQueryRelations(['profile!'], {allowed: ['profile!']});
        expect(output).toEqual([
            {key: 'profile!', value: 'profile!'}
        ] as RelationsParseOutput);
    });

    it('should parse with alias', () => {
        // with alias
        let output = parseQueryRelations('pro', {mapping: {pro: 'profile'}, allowed: ['profile']});
        expect(output).toEqual([
            {key: 'profile', value: 'profile'},
        ]);
    });

    it('should parse with nested alias', () => {
        // with nested alias
        let output = parseQueryRelations(['abc.photos'], {
            allowed: ['profile.photos'],
            mapping: { 'abc.photos': 'profile.photos' },
        });
        expect(output).toEqual([
            { key: 'profile', value: 'profile' },
            { key: 'profile.photos', value: 'photos' },
        ] as RelationsParseOutput);

        // with nested alias & includeParents
        output = parseQueryRelations(['abc.photos'], {
            allowed: ['profile.photos'],
            mapping: { 'abc.photos': 'profile.photos' },
            includeParents: false,
        });
        expect(output).toEqual([
            { key: 'profile.photos', value: 'photos' },
        ] as RelationsParseOutput);

        // with nested alias & limited includeParents ( no user_roles rel)
        output = parseQueryRelations(['abc.photos', 'user_roles.role'], {
            allowed: ['profile.photos', 'user_roles.role'],
            mapping: { 'abc.photos': 'profile.photos' },
            includeParents: ['profile'],
        });
        expect(output).toEqual([
            { key: 'profile', value: 'profile' },
            { key: 'profile.photos', value: 'photos' },
            { key: 'user_roles.role', value: 'role' },
        ] as RelationsParseOutput);

        // multiple data matching
        output = parseQueryRelations(['profile', 'abc'], { allowed: ['profile'] });
        expect(output).toEqual([{ key: 'profile', value: 'profile' }] as RelationsParseOutput);

        // no allowed
        output = parseQueryRelations(['profile'], { allowed: [] });
        expect(output).toEqual([] as RelationsParseOutput);

        // non array, permit everything
        output = parseQueryRelations(['profile'], { allowed: undefined });
        expect(output).toEqual([{key: 'profile', value: 'profile'}] as RelationsParseOutput);

        // nested data with alias
        output = parseQueryRelations(['profile.photos', 'profile.photos.abc', 'profile.abc'], { allowed: ['profile.photos'] });
        expect(output).toEqual([
            { key: 'profile', value: 'profile' },
            { key: 'profile.photos', value: 'photos' },
        ] as RelationsParseOutput);

        // null data
        output = parseQueryRelations(null);
        expect(output).toEqual([]);
    });

    it('should throw on invalid input', () => {
        let options : RelationsOptions = {
            throwOnFailure: true
        };

        let error = RelationsParseError.inputInvalid();

        let evaluate = () => {
            parseQueryRelations(['foo', true], options);
        }
        expect(evaluate).toThrowError(error);

        evaluate = () => {
            parseQueryRelations(false, options);
        }
        expect(evaluate).toThrowError(error);
    });

    it('should throw on non allowed key', () => {
        let options : RelationsOptions = {
            throwOnFailure: true,
            allowed: ['foo']
        };

        let error = RelationsParseError.keyInvalid('bar');

        let evaluate = () => {
            parseQueryRelations(['foo', 'bar'], options);
        }
        expect(evaluate).toThrowError(error);
    });

    it('should throw on invalid key', () => {
        let options : RelationsOptions = {
            throwOnFailure: true
        };

        let error = RelationsParseError.keyInvalid(',foo');

        let evaluate = () => {
            parseQueryRelations([',foo'], options);
        }
        expect(evaluate).toThrowError(error);
    })
});
