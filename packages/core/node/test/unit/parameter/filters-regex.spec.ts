/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FilterRegexFlag,
    createFilterRegex,
    createFilterRegexPattern,
} from '../../../src';

describe('src/parameter/filters/regex.ts', () => {
    it('anchors the pattern for STARTS_WITH', () => {
        expect(createFilterRegexPattern('foo', FilterRegexFlag.STARTS_WITH)).toEqual('^foo');

        const regex = createFilterRegex('foo', FilterRegexFlag.STARTS_WITH);
        expect(regex.test('foobar')).toBeTruthy();
        expect(regex.test('xxfoo')).toBeFalsy();
    });

    it('anchors the pattern for ENDS_WITH', () => {
        expect(createFilterRegexPattern('foo', FilterRegexFlag.ENDS_WITH)).toEqual('foo$');

        const regex = createFilterRegex('foo', FilterRegexFlag.ENDS_WITH);
        expect(regex.test('xxfoo')).toBeTruthy();
        expect(regex.test('foobar')).toBeFalsy();
    });

    it('builds an unanchored pattern for CONTAINS', () => {
        expect(createFilterRegexPattern('foo', FilterRegexFlag.CONTAINS)).toEqual('foo');

        const regex = createFilterRegex('foo', FilterRegexFlag.CONTAINS);
        expect(regex.test('xxfooxx')).toBeTruthy();
        expect(regex.test('bar')).toBeFalsy();
    });

    it('builds negated patterns', () => {
        const cases : [number, string, string, string][] = [
            [
                FilterRegexFlag.STARTS_WITH | FilterRegexFlag.NEGATION,
                '^(?!foo).*',
                'xxfoo',
                'foobar',
            ],
            [
                FilterRegexFlag.ENDS_WITH | FilterRegexFlag.NEGATION,
                '^(?!.*foo$).*',
                'foobar',
                'xxfoo',
            ],
            [
                FilterRegexFlag.CONTAINS | FilterRegexFlag.NEGATION,
                '^(?!.*foo).*',
                'bar',
                'xxfooxx',
            ],
        ];

        for (const [flag, pattern, matching, notMatching] of cases) {
            expect(createFilterRegexPattern('foo', flag), `${flag}`).toEqual(pattern);

            const regex = createFilterRegex('foo', flag);
            expect(regex.test(matching), `${flag}`).toBeTruthy();
            expect(regex.test(notMatching), `${flag}`).toBeFalsy();
        }
    });

    it('matches case-insensitive', () => {
        const regex = createFilterRegex('foo', FilterRegexFlag.STARTS_WITH);

        expect(regex.test('FOObar')).toBeTruthy();
    });

    it('matches the empty string for negated STARTS_WITH', () => {
        const regex = createFilterRegex('foo', FilterRegexFlag.STARTS_WITH | FilterRegexFlag.NEGATION);

        expect(regex.test('')).toBeTruthy();
    });

    it('escapes regex metacharacters so the input matches verbatim', () => {
        expect(createFilterRegexPattern('a.b', FilterRegexFlag.STARTS_WITH)).toEqual('^a\\.b');

        const dot = createFilterRegex('a.b', FilterRegexFlag.CONTAINS);
        expect(dot.test('xa.bx')).toBeTruthy();
        expect(dot.test('xaxbx')).toBeFalsy();

        const alternation = createFilterRegex('a|b', FilterRegexFlag.CONTAINS);
        expect(alternation.test('a|b')).toBeTruthy();
        expect(alternation.test('a')).toBeFalsy();

        // previously threw a SyntaxError (invalid regex)
        const parenthesis = createFilterRegex('(', FilterRegexFlag.STARTS_WITH);
        expect(parenthesis.test('(x')).toBeTruthy();
    });
});
