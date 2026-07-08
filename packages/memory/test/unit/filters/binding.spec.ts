/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    ErrorCode,
    Filter,
    FilterFieldOperator,
    and,
    elemMatch,
    eq,
    exists,
    ne,
    or,
} from '@rapiq/core';
import { compileFilters } from '../../../src';

const user = {
    name: 'Peter',
    items: [
        {
            id: 1, 
            active: false, 
            title: 'first', 
        },
        {
            id: 2, 
            active: true, 
            title: 'second', 
        },
    ],
};

describe('filters: join-row binding', () => {
    it('should match when a single condition holds for some element', () => {
        expect(compileFilters(eq('items.id', 1))(user)).toBeTruthy();
        expect(compileFilters(eq('items.id', 3))(user)).toBeFalsy();
    });

    it('should bind conditions on one relation path to the same element', () => {
        // no single item is both id=1 and active — the joined row
        // cannot satisfy both conditions (sql join parity).
        const predicate = compileFilters(and(
            eq('items.id', 1),
            eq('items.active', true),
        ));

        expect(predicate(user)).toBeFalsy();
        expect(predicate({ items: [{ id: 1, active: true }] })).toBeTruthy();
    });

    it('should evaluate or over one relation path per element combination', () => {
        const predicate = compileFilters(or(
            eq('items.id', 3),
            eq('items.active', true),
        ));

        expect(predicate(user)).toBeTruthy();
        expect(predicate({ items: [{ id: 1, active: false }] })).toBeFalsy();
    });

    it('should bind independent relation paths independently', () => {
        const predicate = compileFilters(and(
            eq('items.id', 1),
            eq('realm.name', 'master'),
        ));

        expect(predicate({ ...user, realm: { name: 'master' } })).toBeTruthy();
        expect(predicate(user)).toBeFalsy();
    });

    it('should contribute a null row for empty or absent arrays', () => {
        expect(compileFilters(eq('items.id', null))({ items: [] })).toBeTruthy();
        expect(compileFilters(eq('items.id', null))({})).toBeTruthy();
        expect(compileFilters(eq('items.id', null))(user)).toBeFalsy();

        expect(compileFilters(exists('items.id', false))({ items: [] })).toBeTruthy();
        expect(compileFilters(ne('items.title', 'first'))({ items: [] })).toBeTruthy();
    });

    it('should quantify negated leaves over elements', () => {
        // some joined row has a title other than 'first' — this is
        // NOT the complement of eq over the whole array (sql parity).
        const predicate = compileFilters(ne('items.title', 'first'));

        expect(predicate(user)).toBeTruthy();
        expect(predicate({ items: [{ id: 1, title: 'first' }] })).toBeFalsy();
    });

    it('should traverse to-one object paths without element choice', () => {
        const input = { realm: { id: 1, name: 'master' } };

        expect(compileFilters(eq('realm.name', 'master'))(input)).toBeTruthy();
        expect(compileFilters(eq('realm.name', 'other'))(input)).toBeFalsy();
        expect(compileFilters(eq('realm.name', null))({ realm: null })).toBeTruthy();
    });

    it('should bind nested relation paths per parent element', () => {
        const input = {
            items: [
                { id: 1, parts: [{ id: 10, name: 'bolt' }] },
                { id: 2, parts: [{ id: 20, name: 'nut' }] },
            ],
        };

        expect(compileFilters(and(
            eq('items.id', 2),
            eq('items.parts.name', 'nut'),
        ))(input)).toBeTruthy();

        // part 'bolt' belongs to item 1, not item 2 — one assignment
        // must satisfy the whole tree.
        expect(compileFilters(and(
            eq('items.id', 2),
            eq('items.parts.name', 'bolt'),
        ))(input)).toBeFalsy();
    });

    describe('elemMatch', () => {
        it('should express same-element matching explicitly', () => {
            expect(compileFilters(elemMatch('items', and(
                eq('id', 2),
                eq('active', true),
            )))(user)).toBeTruthy();

            expect(compileFilters(elemMatch('items', and(
                eq('id', 1),
                eq('active', true),
            )))(user)).toBeFalsy();
        });

        it('should compose prefixes for nested elemMatch', () => {
            const input = {
                items: [
                    { id: 1, parts: [{ id: 10, name: 'bolt' }] },
                ],
            };

            expect(compileFilters(elemMatch('items', elemMatch('parts', and(
                eq('id', 10),
                eq('name', 'bolt'),
            ))))(input)).toBeTruthy();

            expect(compileFilters(elemMatch('items', elemMatch('parts', and(
                eq('id', 10),
                eq('name', 'nut'),
            ))))(input)).toBeFalsy();
        });

        it('should evaluate against a to-one object like a join', () => {
            const input = { realm: { id: 1, name: 'master' } };

            expect(compileFilters(elemMatch('realm', and(
                eq('id', 1),
                eq('name', 'master'),
            )))(input)).toBeTruthy();

            expect(compileFilters(elemMatch('realm', eq('name', 'other')))(input)).toBeFalsy();
        });

        it('should collapse two elemMatches on one field to the same element', () => {
            // both reference the same join path — sql parity fallout,
            // settled in plan 014.
            const predicate = compileFilters(and(
                elemMatch('items', eq('id', 1)),
                elemMatch('items', eq('active', true)),
            ));

            expect(predicate(user)).toBeFalsy();
            expect(predicate({ items: [{ id: 1, active: true }] })).toBeTruthy();
        });

        it('should reject a non-condition value', () => {
            const expr = new Filter(FilterFieldOperator.ELEM_MATCH, 'items', { id: 1 });

            expect(() => compileFilters(expr)).toThrow(AdapterError);

            try {
                compileFilters(expr);
            } catch (e) {
                expect((e as AdapterError).code).toEqual(ErrorCode.FEATURE_UNSUPPORTED);
            }
        });

        it('should share the binding with dotted siblings on the same path', () => {
            // elemMatch is prefix rewriting: both conditions reference
            // the items join and therefore the same element (sql parity).
            const predicate = compileFilters(and(
                elemMatch('items', eq('id', 1)),
                eq('items.active', true),
            ));

            expect(predicate(user)).toBeFalsy();
            expect(predicate({ items: [{ id: 1, active: true }] })).toBeTruthy();
        });
    });
});
