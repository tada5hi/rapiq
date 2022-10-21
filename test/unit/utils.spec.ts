/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { flattenParseOptionsAllowed, isPathCoveredByParseAllowed} from "../../src";
import {applyMapping} from "../../src/utils";
import { User } from "../data";

describe('src/utils/*.ts', () => {
    it('should get name by alias', () => {
        let data = applyMapping('a.b.c', {
            'a': 'p',
            'b.c': 'a'
        });
        expect(data).toEqual('p.a');

        data = applyMapping('a.b.c', {
            'a': 'p',
            'c': 'a'
        });
        expect(data).toEqual('p.b.a');

        data = applyMapping('a.b.c.d.e', {
            'a': 'z',
            'c.d': 'y'
        });
        expect(data).toEqual('z.b.y.e');
    });

    it('should flatten nested parse option keys', () => {
        let data = flattenParseOptionsAllowed<User>(['id', 'name']);
        expect(data).toEqual(['id', 'name']);

        data = flattenParseOptionsAllowed<User>({
            realm: ['id'],
            items: ['realm.name']
        });
        expect(data).toEqual([
            'realm.id',
            'items.realm.name'
        ])

    });

    it('should verify if path is covered by parse options', () => {
        let result = isPathCoveredByParseAllowed<User>(['id', 'name'], 'id');
        expect(result).toBeTruthy();

        result = isPathCoveredByParseAllowed<User>(['id', 'name'], 'description');
        expect(result).toBeFalsy();

        // -----------------------------------------------------------

        result = isPathCoveredByParseAllowed<User>({realm: ['id', 'name']}, 'realm.id');
        expect(result).toBeTruthy();

        result = isPathCoveredByParseAllowed<User>({realm: ['id', 'name']}, 'realm.description');
        expect(result).toBeFalsy();

        // -----------------------------------------------------------

        result = isPathCoveredByParseAllowed<User>(['realm.id', 'realm.name'], 'realm.id');
        expect(result).toBeTruthy();

        result = isPathCoveredByParseAllowed<User>(['realm.id', 'realm.name'], 'realm.description');
        expect(result).toBeFalsy();

        // -----------------------------------------------------------

        result = isPathCoveredByParseAllowed<User>([['name'], { realm: ['id'] }], 'name');
        expect(result).toBeTruthy();

        result = isPathCoveredByParseAllowed<User>([['name'], { realm: ['id'] }], 'id');
        expect(result).toBeFalsy();

        result = isPathCoveredByParseAllowed<User>([['name'], { realm: ['id'] }], 'realm.id');
        expect(result).toBeTruthy();

        result = isPathCoveredByParseAllowed<User>([['name'], { realm: ['id'] }], 'realm.name');
        expect(result).toBeFalsy();

        // -----------------------------------------------------------

        result = isPathCoveredByParseAllowed<User>({items: ['realm.id']}, 'items.realm.id');
        expect(result).toBeTruthy();

        result = isPathCoveredByParseAllowed<User>({items: ['realm.name']}, 'items.realm.id');
        expect(result).toBeFalsy();

        // -----------------------------------------------------------

        result = isPathCoveredByParseAllowed<User>({items: {realm: ['id']}}, 'items.realm.id');
        expect(result).toBeTruthy();

        result = isPathCoveredByParseAllowed<User>({items: {realm: ['name']}}, 'items.realm.id');
        expect(result).toBeFalsy();
    })
})
