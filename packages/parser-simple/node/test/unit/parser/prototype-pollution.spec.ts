/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ParseError } from '@rapiq/core';
import { SimpleParser } from '../../../src';

/**
 * The per-parameter parsers keep their own accumulators keyed by a
 * client-controlled path prefix, so core's hardened grouping helpers do
 * not cover them. A prefix naming an inherited member must never be
 * written through, whatever syntax it arrives in — including behind the
 * numeric group prefix the key grammar allows ("0:items.title").
 */
describe('src/parameter (prototype pollution)', () => {
    let parser : SimpleParser;

    beforeEach(() => {
        parser = new SimpleParser();
    });

    afterEach(() => {
        for (const key of ['polluted', 'a', '__DEFAULT__', 'isAdmin']) {
            delete (Object.prototype as any)[key];
        }
    });

    const HOSTILE = [
        '__proto__',
        'constructor',
        'prototype',
        '0:__proto__',
        '1:constructor',
        '12:prototype',
    ];

    const propertyCount = () => Object.getOwnPropertyNames(Object.prototype).length;

    it.each(HOSTILE)('should not pollute via a %s fields group', (prefix) => {
        const before = propertyCount();

        // a hostile segment is never a legitimate key: the guard
        // rejects it typed rather than dropping it silently
        expect(() => parser.parse({ fields: [`${prefix}.a`, `${prefix}.polluted`] }))
            .toThrow(ParseError);


        expect(propertyCount()).toBe(before);
        expect(({} as any).a).toBeUndefined();
        expect(({} as any).polluted).toBeUndefined();
    });

    it.each(HOSTILE)('should not pollute via a %s sort group', (prefix) => {
        const before = propertyCount();

        // a hostile segment is never a legitimate key: the guard
        // rejects it typed rather than dropping it silently
        expect(() => parser.parse({ sort: [`${prefix}.a`] }))
            .toThrow(ParseError);


        expect(propertyCount()).toBe(before);
        expect(({} as any).a).toBeUndefined();
    });

    it.each(HOSTILE)('should not pollute via a %s relations group', (prefix) => {
        const before = propertyCount();

        // a hostile segment is never a legitimate key: the guard
        // rejects it typed rather than dropping it silently
        expect(() => parser.parse({ relations: [`${prefix}.a`] }))
            .toThrow(ParseError);


        expect(propertyCount()).toBe(before);
        expect(({} as any).a).toBeUndefined();
    });

    it.each(HOSTILE)('should not pollute via a %s filters group', (prefix) => {
        const before = propertyCount();

        // a hostile segment is never a legitimate key: the guard
        // rejects it typed rather than dropping it silently
        expect(() => parser.parse({ filters: { [`${prefix}.a`]: '1' } }))
            .toThrow(ParseError);


        expect(propertyCount()).toBe(before);
        expect(({} as any).a).toBeUndefined();
    });

    it.each(HOSTILE)('should not pollute via a %s pagination key', (prefix) => {
        const before = propertyCount();

        // pagination never groups its keys, so the guard runs explicitly
        // in the parser: a hostile key is rejected typed, not ignored
        expect(() => parser.parse({ pagination: { [prefix]: { polluted: '1' } } }))
            .toThrow(ParseError);

        expect(propertyCount()).toBe(before);
        expect(({} as any).polluted).toBeUndefined();
    });

    it('should not pollute via a nested hostile pagination key', () => {
        const before = propertyCount();

        // a computed key is an OWN property (unlike a bare `__proto__`
        // literal, which JS neutralizes before the parser ever sees it)
        expect(() => parser.parse({ pagination: { limit: { ['__proto__']: { polluted: '1' } } } }))
            .toThrow(ParseError);

        expect(propertyCount()).toBe(before);
        expect(({} as any).polluted).toBeUndefined();
    });

    it('should still parse legitimate pagination input', () => {
        const output = parser.parse({ pagination: { limit: 10, offset: 5 } });

        expect(output.pagination.limit).toEqual(10);
        expect(output.pagination.offset).toEqual(5);
    });

    it('should still parse a legitimate grouped sort key', () => {
        const output = parser.parse({ sort: ['0:name'] });

        expect(output.sorts.value.map((sort) => sort.name)).toEqual(['name']);
    });
});
