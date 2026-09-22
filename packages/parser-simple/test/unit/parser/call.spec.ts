/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, ParseError } from '@rapiq/core';
import { parseCallTerms, serializeCallTerm } from '../../../src';

function errorOf(input: unknown) : ParseError | undefined {
    try {
        parseCallTerms(input);
    } catch (e) {
        return e as ParseError;
    }

    return undefined;
}

describe('src/parameter/call', () => {
    it('should split terms only at parenthesis depth zero', () => {
        expect(parseCallTerms('bucket(createdAt,day),scope,name')).toEqual([
            { name: 'bucket', params: ['createdAt', 'day'] },
            { name: 'scope', params: [] },
            { name: 'name', params: [] },
        ]);
    });

    it('should read count and count() as the same term', () => {
        expect(parseCallTerms('count')).toEqual([{ name: 'count', params: [] }]);
        expect(parseCallTerms('count()')).toEqual([{ name: 'count', params: [] }]);
        expect(parseCallTerms('count( )')).toEqual([{ name: 'count', params: [] }]);
    });

    it('should trim spaces and tabs around identifiers', () => {
        expect(parseCallTerms(' bucket ( createdAt ,\tday ) , scope')).toEqual([
            { name: 'bucket', params: ['createdAt', 'day'] },
            { name: 'scope', params: [] },
        ]);
    });

    it('should read every element of an array as a list', () => {
        expect(parseCallTerms(['scope', 'bucket(createdAt,day),name'])).toEqual([
            { name: 'scope', params: [] },
            { name: 'bucket', params: ['createdAt', 'day'] },
            { name: 'name', params: [] },
        ]);
    });

    it('should read an empty input as no terms', () => {
        expect(parseCallTerms('')).toEqual([]);
        expect(parseCallTerms([])).toEqual([]);
        expect(parseCallTerms(['', ' '])).toEqual([]);
        expect(parseCallTerms(undefined)).toEqual([]);
    });

    it('should leave identifier validity to resolution', () => {
        // the grammar knows no function names and no identifier rules
        expect(parseCallTerms('realm.id,1foo(a-b)')).toEqual([
            { name: 'realm.id', params: [] },
            { name: '1foo', params: ['a-b'] },
        ]);
    });

    it.each([
        ['a,,b'],
        ['a,'],
        [',a'],
        ['f(a'],
        ['f(a))'],
        ['f)a('],
        ['f(g(a))'],
        ['f(a)b'],
        ['f(a),(b)'],
        ['f(a,)'],
        ['f(,a)'],
        ['f(\'a\')'],
        ['f("a")'],
        ['a b'],
        ['f(\na)'],
        ['f(a\r)'],
        ['f(a,\u00A0b)'],
        ['f(\u2028)'],
        ['\n'],
    ])('should reject %s as a syntax violation', (input) => {
        const error = errorOf(input);

        expect(error).toBeInstanceOf(ParseError);
        expect(error?.code).toBe(ErrorCode.SYNTAX_INVALID);
    });

    it.each([
        [5],
        [{ scope: true }],
        [['scope', 5]],
        [null],
    ])('should reject %j as an invalid input shape', (input) => {
        const error = errorOf(input);

        expect(error).toBeInstanceOf(ParseError);
        expect(error?.code).toBe(ErrorCode.INPUT_INVALID);
    });

    it('should serialize a term without whitespace', () => {
        expect(serializeCallTerm({ name: 'scope', params: [] })).toBe('scope');
        expect(serializeCallTerm({ name: 'bucket', params: ['createdAt', 'day'] })).toBe('bucket(createdAt,day)');
    });

    describe('linear time on long blank runs', () => {
        const LENGTH = 100_000;

        function timed(input: string) : { error: ParseError | undefined, ms: number } {
            const start = performance.now();
            const error = errorOf(input);

            return { error, ms: performance.now() - start };
        }

        it.each([
            ['blanks between two identifiers', `a${' '.repeat(LENGTH)}b`],
            ['tabs inside an argument list', `f(a${'\t'.repeat(LENGTH)}b)`],
            ['blank runs around arguments', `f(${' '.repeat(LENGTH)}x ${' '.repeat(LENGTH)}y)`],
        ])('should reject %s quickly', (_label, input) => {
            const { error, ms } = timed(input);

            expect(error).toBeInstanceOf(ParseError);
            expect(error?.code).toBe(ErrorCode.SYNTAX_INVALID);
            expect(ms).toBeLessThan(200);
        });

        it('should accept blank padding quickly', () => {
            const blanks = ' \t'.repeat(LENGTH);
            const input = `${blanks}f(${blanks}a${blanks},${blanks}b${blanks})${blanks},${blanks}g${blanks}`;

            const start = performance.now();
            const output = parseCallTerms(input);
            const ms = performance.now() - start;

            expect(output).toEqual([
                { name: 'f', params: ['a', 'b'] },
                { name: 'g', params: [] },
            ]);
            expect(ms).toBeLessThan(200);
        });
    });

    it('should round trip a serialized term', () => {
        const term = { name: 'total', params: ['amount'] };

        expect(parseCallTerms(serializeCallTerm(term))).toEqual([term]);
    });
});
