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
        // The linear scan parses these inputs in well under a millisecond; the
        // quadratic trim it replaced needs ~0.7 s for 40k blanks. Best of three
        // absorbs a GC pause or a loaded runner, and the 50 ms bound leaves
        // orders of magnitude on both sides.
        const LENGTH = 40_000;
        const BOUND = 50;

        function fastest(input: string) : number {
            let min = Infinity;
            for (let i = 0; i < 3; i++) {
                const start = performance.now();
                errorOf(input);
                min = Math.min(min, performance.now() - start);
            }

            return min;
        }

        it.each([
            ['blanks between two identifiers', `a${' '.repeat(LENGTH)}b`],
            ['tabs inside an argument list', `f(a${'\t'.repeat(LENGTH)}b)`],
            ['blank runs around arguments', `f(${' '.repeat(LENGTH)}x ${' '.repeat(LENGTH)}y)`],
        ])('should reject %s in linear time', (_label, input) => {
            const error = errorOf(input);
            expect(error).toBeInstanceOf(ParseError);
            expect(error?.code).toBe(ErrorCode.SYNTAX_INVALID);

            expect(fastest(input)).toBeLessThan(BOUND);
        });

        it('should accept blank padding in linear time', () => {
            const blanks = ' \t'.repeat(LENGTH / 8);
            const input = `${blanks}f(${blanks}a${blanks},${blanks}b${blanks})${blanks},${blanks}g${blanks}`;

            expect(parseCallTerms(input)).toEqual([
                { name: 'f', params: ['a', 'b'] },
                { name: 'g', params: [] },
            ]);
            expect(fastest(input)).toBeLessThan(BOUND);
        });
    });

    it('should round trip a serialized term', () => {
        const term = { name: 'total', params: ['amount'] };

        expect(parseCallTerms(serializeCallTerm(term))).toEqual([term]);
    });
});
