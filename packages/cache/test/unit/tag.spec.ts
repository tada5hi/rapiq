/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    buildCollectionTag,
    buildRecordTag,
    buildScopedTag,
    isScopedTagValue,
} from '../../src';

describe('src/tag.ts', () => {
    it('should build the collection tag from the schema name', () => {
        expect(buildCollectionTag('role')).toEqual('role');
    });

    it('should build a record tag from the schema name and the id', () => {
        expect(buildRecordTag('role', 'abc')).toEqual('role:abc');
        expect(buildRecordTag('role', 5)).toEqual('role:5');
    });

    it('should build a scoped tag with the stringified value', () => {
        expect(buildScopedTag('userRole', 'userId', 'u1')).toEqual('userRole:userId=u1');
        expect(buildScopedTag('userRole', 'userId', 7)).toEqual('userRole:userId=7');
        expect(buildScopedTag('role', 'active', true)).toEqual('role:active=true');
        expect(buildScopedTag('role', 'realmId', null)).toEqual('role:realmId=null');
    });

    it('should accept only string, number, boolean and null as a scoped value', () => {
        expect(isScopedTagValue('a')).toBeTruthy();
        expect(isScopedTagValue(1)).toBeTruthy();
        expect(isScopedTagValue(false)).toBeTruthy();
        expect(isScopedTagValue(null)).toBeTruthy();

        expect(isScopedTagValue(undefined)).toBeFalsy();
        expect(isScopedTagValue({})).toBeFalsy();
        expect(isScopedTagValue([1])).toBeFalsy();
        expect(isScopedTagValue(new Date(0))).toBeFalsy();
    });
});
