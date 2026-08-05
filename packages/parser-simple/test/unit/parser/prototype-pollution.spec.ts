/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

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

        try {
            parser.parse({ fields: [`${prefix}.a`, `${prefix}.polluted`] });
        } catch {
            // a typed rejection is an acceptable outcome; pollution is not
        }

        expect(propertyCount()).toBe(before);
        expect(({} as any).a).toBeUndefined();
        expect(({} as any).polluted).toBeUndefined();
    });

    it.each(HOSTILE)('should not pollute via a %s sort group', (prefix) => {
        const before = propertyCount();

        try {
            parser.parse({ sort: [`${prefix}.a`] });
        } catch {
            // as above
        }

        expect(propertyCount()).toBe(before);
        expect(({} as any).a).toBeUndefined();
    });

    it.each(HOSTILE)('should not pollute via a %s relations group', (prefix) => {
        const before = propertyCount();

        try {
            parser.parse({ relations: [`${prefix}.a`] });
        } catch {
            // as above
        }

        expect(propertyCount()).toBe(before);
        expect(({} as any).a).toBeUndefined();
    });

    it.each(HOSTILE)('should not pollute via a %s filters group', (prefix) => {
        const before = propertyCount();

        try {
            parser.parse({ filters: { [`${prefix}.a`]: '1' } });
        } catch {
            // as above
        }

        expect(propertyCount()).toBe(before);
        expect(({} as any).a).toBeUndefined();
    });

    it('should still parse a legitimate grouped sort key', () => {
        const output = parser.parse({ sort: ['0:name'] });

        expect(output.sorts.value.map((sort) => sort.name)).toEqual(['name']);
    });
});
