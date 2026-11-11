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
    normalizeScopedUuid,
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
        expect(buildScopedTag('role', 'realmId', null)).toEqual('role:realmId=null');
    });

    it('should spell a boolean as the number a filter may carry for it', () => {
        expect(buildScopedTag('role', 'active', true)).toEqual('role:active=1');
        expect(buildScopedTag('role', 'active', false)).toEqual('role:active=0');
        expect(buildScopedTag('role', 'active', true)).toEqual(buildScopedTag('role', 'active', 1));
        expect(buildScopedTag('role', 'active', false)).toEqual(buildScopedTag('role', 'active', 0));
    });

    it('should spell a Date as its epoch milliseconds', () => {
        const date = new Date('2026-01-02T03:04:05.000Z');

        expect(buildScopedTag('event', 'createdAt', date)).toEqual(`event:createdAt=${date.getTime()}`);
        expect(buildScopedTag('event', 'createdAt', date)).toEqual(buildScopedTag('event', 'createdAt', date.getTime()));
    });

    it('should accept only string, number, boolean, a valid Date and null as a scoped value', () => {
        expect(isScopedTagValue('a')).toBeTruthy();
        expect(isScopedTagValue(1)).toBeTruthy();
        expect(isScopedTagValue(false)).toBeTruthy();
        expect(isScopedTagValue(null)).toBeTruthy();
        expect(isScopedTagValue(new Date(0))).toBeTruthy();

        expect(isScopedTagValue(undefined)).toBeFalsy();
        expect(isScopedTagValue({})).toBeFalsy();
        expect(isScopedTagValue([1])).toBeFalsy();
        expect(isScopedTagValue(new Date(NaN))).toBeFalsy();
    });
});

describe('normalizeScopedUuid', () => {
    const CANONICAL = 'abcdef01-2345-6789-abcd-ef0123456789';

    it('should lower-case a hyphenated uuid', () => {
        expect(normalizeScopedUuid('userRole', 'userId', 'ABCDEF01-2345-6789-ABCD-EF0123456789')).toEqual(CANONICAL);
        expect(normalizeScopedUuid('userRole', 'userId', CANONICAL)).toEqual(CANONICAL);
    });

    it('should hyphenate the other spellings postgres reads', () => {
        expect(normalizeScopedUuid('userRole', 'userId', '{ABCDEF01-2345-6789-ABCD-EF0123456789}')).toEqual(CANONICAL);
        expect(normalizeScopedUuid('userRole', 'userId', 'ABCDEF0123456789ABCDEF0123456789')).toEqual(CANONICAL);
        expect(normalizeScopedUuid('userRole', 'userId', 'abcd-ef01-2345-6789-abcd-ef01-2345-6789')).toEqual(CANONICAL);
    });

    it('should pass everything else through untouched', () => {
        const date = new Date(0);

        for (const value of [
            'Master',
            'u1',
            'ABCDEF01-2345-6789-ABCD-EF012345678',
            'ABCDEF01-2345-6789-ABCD-EF0123456789Z',
            '{ABCDEF01-2345-6789-ABCD-EF0123456789',
            7,
            true,
            null,
            date,
        ]) {
            expect(normalizeScopedUuid('userRole', 'userId', value)).toBe(value);
        }
    });
});
