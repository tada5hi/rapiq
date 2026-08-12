/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, ParseError } from '@rapiq/core';
import { SimpleParser } from '../../src';

describe('src/module.ts', () => {
    const parser = new SimpleParser();

    it('should read the canonical sorts key', () => {
        const query = parser.parse({ sorts: { name: 'DESC' } });

        expect(query.sorts.value.map((el) => [el.name, el.operator]))
            .toEqual([['name', 'DESC']]);
    });

    it('should read the deprecated sort key', () => {
        const query = parser.parse({ sort: { name: 'DESC' } });

        expect(query.sorts.value.map((el) => [el.name, el.operator]))
            .toEqual([['name', 'DESC']]);
    });

    it('should reject both input spellings at once', () => {
        expect(() => parser.parse({ sorts: { name: 'DESC' }, sort: { id: 'ASC' } }))
            .toThrow(ParseError);
    });

    it('should carry the ambiguous-key error code', () => {
        try {
            parser.parse({ sorts: {}, sort: {} });
            expect.unreachable('parse did not throw');
        } catch (e) {
            expect((e as ParseError).code).toBe(ErrorCode.KEY_AMBIGUOUS);
        }
    });

    it('should skip the parameter through either option spelling', () => {
        const input = { sorts: { name: 'DESC' } };

        expect(parser.parse(input, { sorts: false }).sorts.value.length).toBe(0);
        expect(parser.parse(input, { sort: false }).sorts.value.length).toBe(0);
    });

    it('should select the parameter through either mask spelling', () => {
        const input = { sorts: { name: 'DESC' } };

        expect(parser.parse(input, { parameters: ['sorts'] }).sorts.value.length).toBe(1);
        expect(parser.parse(input, { parameters: ['sort'] }).sorts.value.length).toBe(1);
        expect(parser.parse(input, { parameters: ['fields'] }).sorts.value.length).toBe(0);
    });

    it('should reject both option spellings at once', () => {
        expect(() => parser.parse({ sorts: {} }, { sorts: false, sort: false } as any))
            .toThrow(ParseError);
    });

    it('should still ignore unrelated input keys', () => {
        expect(() => parser.parse({ token: 'abc', sorts: { name: 'DESC' } })).not.toThrow();
    });
});
