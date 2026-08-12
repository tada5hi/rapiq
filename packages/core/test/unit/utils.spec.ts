/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Parameter,
    isObject,
    isPropertySet,
    normalizeParameter,
    parseKey,
    stringifyKey,
} from '../../src';
import { applyMapping } from '../../src/utils';

describe('src/utils/*.ts', () => {
    it('should get name by alias', () => {
        let data = applyMapping('a.b.c', {
            a: 'p',
            'b.c': 'a',
        });
        expect(data).toEqual('p.a');

        data = applyMapping('a.b.c', {
            a: 'p',
            c: 'a',
        });
        expect(data).toEqual('p.b.a');

        data = applyMapping('a.b.c.d.e', {
            a: 'z',
            'c.d': 'y',
        });
        expect(data).toEqual('z.b.y.e');
    });

    it('should parse keys', () => {
        expect(parseKey('name')).toEqual({
            name: 'name', 
            group: undefined, 
            path: '', 
        });
        expect(parseKey('items.realm.name')).toEqual({
            name: 'name', 
            group: undefined, 
            path: 'items.realm', 
        });
        expect(parseKey('0:items.name')).toEqual({
            name: 'name', 
            group: '0', 
            path: 'items', 
        });
        expect(parseKey('!invalid')).toEqual({ name: '!invalid' });
    });

    it('should stringify keys', () => {
        expect(stringifyKey({ name: 'name' })).toEqual('name');
        expect(stringifyKey({ name: 'name', path: 'items' })).toEqual('items.name');
        expect(stringifyKey({
            name: 'name', 
            path: 'items', 
            group: '0', 
        })).toEqual('0:items.name');
    });

    it('should round-trip parse & stringify', () => {
        expect(stringifyKey(parseKey('0:items.realm.name'))).toEqual('0:items.realm.name');
    });

    it('should detect plain objects', () => {
        expect(isObject({})).toBeTruthy();
        expect(isObject([])).toBeFalsy();
        expect(isObject(null)).toBeFalsy();
        expect(isObject('foo')).toBeFalsy();
    });

    it('should detect set properties', () => {
        expect(isPropertySet({ foo: undefined }, 'foo')).toBeTruthy();
        expect(isPropertySet({}, 'foo' as never)).toBeFalsy();
    });
});

describe('src/utils/parameter.ts', () => {
    it('should fold the deprecated sort spelling onto sorts', () => {
        expect(normalizeParameter(Parameter.SORT)).toBe(Parameter.SORTS);
        expect(normalizeParameter('sort')).toBe('sorts');
    });

    it('should pass every other parameter through unchanged', () => {
        expect(normalizeParameter('fields')).toBe('fields');
        expect(normalizeParameter('filters')).toBe('filters');
        expect(normalizeParameter('pagination')).toBe('pagination');
        expect(normalizeParameter('relations')).toBe('relations');
        expect(normalizeParameter('sorts')).toBe('sorts');
    });

    it('should keep the deprecated enum member value stable', () => {
        expect(Parameter.SORT).toBe('sort');
        expect(Parameter.SORTS).toBe('sorts');
    });
});
