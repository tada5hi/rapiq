/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { BaseError, BaseParser } from '../../../src';

/**
 * The grouping helpers accumulate client-controlled path prefixes into
 * plain objects. A prefix naming an inherited `Object.prototype` member
 * must never reach the accumulator: neither by writing through it, nor
 * by being mistaken for an already-present group.
 */
class TestParser extends BaseParser {
    parse(input: unknown) {
        return input;
    }

    expand(input: Record<string, any>) {
        return this.expandObject(input);
    }

    group(input: Record<string, any>) {
        return this.groupObject(input);
    }

    groupObjectPaths(input: Record<string, any>) {
        return this.groupObjectByBasePath(input);
    }

    groupArrayPaths(input: string[]) {
        return this.groupArrayByBasePath(input);
    }

    groupArrayKeys(input: string[]) {
        return this.groupArrayByKeyPath(input);
    }
}

const POLLUTING_PREFIXES = ['__proto__', 'constructor', 'prototype'];

describe('src/parser/base.ts (prototype pollution)', () => {
    let parser : TestParser;

    beforeEach(() => {
        parser = new TestParser();
    });

    afterEach(() => {
        // a leak here would silently corrupt every later spec
        delete (Object.prototype as any).polluted;
        delete (Object.prototype as any).isAdmin;
    });

    it('should not pollute Object.prototype via groupObjectByBasePath', () => {
        for (const prefix of POLLUTING_PREFIXES) {
            expect(() => parser.groupObjectPaths({ [`${prefix}.polluted`]: 'ASC' }))
                .toThrow(BaseError);

            expect(({} as any).polluted).toBeUndefined();
        }
    });

    it('should not pollute Object.prototype via groupArrayByBasePath', () => {
        for (const prefix of POLLUTING_PREFIXES) {
            expect(() => parser.groupArrayPaths([`${prefix}.polluted`]))
                .toThrow(BaseError);

            expect(({} as any).polluted).toBeUndefined();
        }
    });

    it('should not pollute Object.prototype via groupArrayByKeyPath', () => {
        for (const prefix of POLLUTING_PREFIXES) {
            expect(() => parser.groupArrayKeys([`${prefix}.polluted`]))
                .toThrow(BaseError);

            expect(({} as any).polluted).toBeUndefined();
        }
    });

    it('should not pollute Object.prototype via expandObject', () => {
        for (const prefix of POLLUTING_PREFIXES) {
            expect(() => parser.expand({ [`${prefix}.polluted`]: 'x' }))
                .toThrow(BaseError);

            expect(({} as any).polluted).toBeUndefined();
        }
    });

    it('should not reassign the prototype via groupObject', () => {
        // a computed key is an OWN property named `__proto__`,
        // unlike the literal form which sets the prototype instead
        expect(() => parser.group({ ['__proto__']: { polluted: 'x' } }))
            .toThrow(BaseError);

        expect(({} as any).polluted).toBeUndefined();
    });

    it('should still group a legitimate dotted path', () => {
        expect(parser.groupArrayKeys(['items.realm.id']))
            .toEqual({ 'items.realm': ['id'] });

        expect(parser.groupArrayPaths(['items.id']))
            .toEqual({ items: ['id'] });
    });

    it('should not treat a field merely containing a reserved word as hostile', () => {
        expect(parser.groupArrayKeys(['constructorName']))
            .toBeDefined();

        expect(parser.groupArrayPaths(['reconstructor.id']))
            .toEqual({ reconstructor: ['id'] });
    });
});
