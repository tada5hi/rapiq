/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    SortDirection,
    SortParseOptions,
    SortParseOutput,
    parseQueryRelations,
    parseQuerySort,
    FieldsParseOutput,
} from '../../src';
import {User} from "../data";

describe('src/sort/index.ts', () => {
    it('should parse sort data', () => {
        // sort asc
        let transformed = parseQuerySort('id', { allowed: ['id'] });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.ASC }] as SortParseOutput);

        // sort desc
        transformed = parseQuerySort('-id', { allowed: ['id'] });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);

        // invalid field names
        transformed = parseQuerySort('-!id');
        expect(transformed).toEqual([] as FieldsParseOutput);

        // ignore field name pattern, if permitted by allowed key
        transformed = parseQuerySort(['-!id'], { allowed: ['!id'] });
        expect(transformed).toEqual([{key: '!id', value: SortDirection.DESC}] as FieldsParseOutput);

        // empty allowed
        transformed = parseQuerySort('-id', { allowed: [] });
        expect(transformed).toEqual([] as SortParseOutput);

        // undefined allowed
        transformed = parseQuerySort('-id', { allowed: undefined });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);

        // only default
        transformed = parseQuerySort('name', { default: { name: 'DESC' } });
        expect(transformed).toEqual([{ key: 'name', value: SortDirection.ASC }] as SortParseOutput);

        // only default with no match
        transformed = parseQuerySort('-id', { default: { name: 'DESC' } });
        expect(transformed).toEqual([{ key: 'name', value: SortDirection.DESC }] as SortParseOutput);

        // wrong allowed
        transformed = parseQuerySort('-id', { allowed: ['a'] });
        expect(transformed).toEqual([] as SortParseOutput);

        // array data
        transformed = parseQuerySort(['-id'], { allowed: ['id'] });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);

        // object data
        transformed = parseQuerySort({ id: 'ASC' }, { allowed: ['id'] });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.ASC }] as SortParseOutput);

        // wrong input data data
        transformed = parseQuerySort({ id: 'Right' }, { allowed: ['id'] });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.ASC }] as SortParseOutput);

        // with query alias
        transformed = parseQuerySort('-id', { allowed: ['id'] });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);

        // with mapping
        transformed = parseQuerySort('-pit', { mapping: { pit: 'id' }, allowed: ['id'] });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);

        // with mapping & query alias
        transformed = parseQuerySort('-pit', { mapping: { pit: 'id' }, allowed: ['id'] });
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);
    });

    it('should transform sort with default', () => {
        const options : SortParseOptions<{id: number, name: string, role: {id: number}}> = {
            allowed: ['id', 'name'],
            default: {
                id: 'DESC'
            }
        };

        let transformed = parseQuerySort(['id'], options);
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.ASC }] as SortParseOutput);

        transformed = parseQuerySort(undefined, options);
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);

        transformed = parseQuerySort([], options);
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);

        transformed = parseQuerySort('-age', options);
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.DESC }] as SortParseOutput);
    })

    it('should transform sort with sort indexes', () => {
        const options : SortParseOptions<User> = {
            allowed: [
                ['name', 'email'],
                ['id'],
            ],
        };

        // simple
        let transformed = parseQuerySort(['id'], options);
        expect(transformed).toEqual([{ key: 'id', value: SortDirection.ASC }] as SortParseOutput);

        // correct order
        transformed = parseQuerySort(['name', 'email'], options);
        expect(transformed).toStrictEqual([
            { key: 'name', value: SortDirection.ASC },
            { key: 'email', value: SortDirection.ASC },
        ] as SortParseOutput);

        // incorrect order
        transformed = parseQuerySort(['email', 'name'], options);
        expect(transformed).toStrictEqual([
            { key: 'name', value: SortDirection.ASC },
            { key: 'email', value: SortDirection.ASC },
        ] as SortParseOutput);

        // incomplete match
        transformed = parseQuerySort(['email', 'id'], {...options, defaultPath: 'user'});
        expect(transformed).toStrictEqual([
            { key: 'id', path: 'user', value: SortDirection.ASC },
        ] as SortParseOutput);

        // no match
        transformed = parseQuerySort(['email'], options);
        expect(transformed).toStrictEqual([]);
    });

    it('should transform sort data with includes', () => {
        const includes = parseQueryRelations(['profile', 'user_roles.role'], {allowed: ['profile', 'user_roles.role']});

        const options : SortParseOptions = {
            allowed: ['id', 'profile.id', 'user_roles.role.id'],
            relations: includes,
        };

        // simple
        let transformed = parseQuerySort(['id'], options);
        expect(transformed).toEqual([
            { key: 'id', value: SortDirection.ASC },
        ] as SortParseOutput);

        // with query alias
        transformed = parseQuerySort(['id'], { ...options });
        expect(transformed).toEqual([
            { key: 'id', value: SortDirection.ASC },
        ] as SortParseOutput);

        // with include
        transformed = parseQuerySort(['id', 'profile.id'], options);
        expect(transformed).toEqual([
            { key: 'id', value: SortDirection.ASC },
            { path: 'profile', key: 'id', value: SortDirection.ASC },
        ] as SortParseOutput);

        // with include & query alias
        transformed = parseQuerySort(['id', 'profile.id'], { ...options});
        expect(transformed).toEqual([
            { key: 'id', value: SortDirection.ASC },
            { path: 'profile', key: 'id', value: SortDirection.ASC },
        ] as SortParseOutput);

        // with deep nested include
        transformed = parseQuerySort(['id', 'user_roles.role.id', 'user_roles.user.id'], options);
        expect(transformed).toEqual([
            { key: 'id', value: SortDirection.ASC },
            { path: 'user_roles.role', key: 'id', value: SortDirection.ASC },
        ] as SortParseOutput);
    });
});
