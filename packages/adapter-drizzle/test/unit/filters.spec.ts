/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition } from '@rapiq/core';
import {
    AdapterError,
    FilterCompoundOperator,
    Filters,
    Query,
    and,
    contains,
    elemMatch,
    eq,
    exists,
    gte,
    inArray,
    lt,
    mod,
    ne,
    nin,
    not,
    notContains,
    or,
    regex,
    size,
    startsWith,
} from '@rapiq/core';
import type { FindManyConfig } from '../../src';
import { DrizzleAdapter } from '../../src';
import { createAdapterOptions } from '../data';

function serialize(condition: Condition, overrides: Record<string, any> = {}) : FindManyConfig {
    const filters = new Filters(FilterCompoundOperator.AND, [condition]);
    const adapter = new DrizzleAdapter(createAdapterOptions(overrides));

    return adapter.execute(new Query({ filters })).config;
}

describe('src/adapter/where.ts', () => {
    describe('equality family', () => {
        it('should lower an insensitive equality to an escaped ilike', () => {
            expect(serialize(eq('address', 'Hogwarts')).where).toEqual({ address: { ilike: 'Hogwarts' } });
        });

        it('should escape LIKE wildcards in the lowered operand', () => {
            expect(serialize(eq('address', '50%_\\')).where).toEqual({ address: { ilike: '50\\%\\_\\\\' } });
        });

        it('should keep non-string comparisons exact', () => {
            expect(serialize(eq('age', 18)).where).toEqual({ age: { eq: 18 } });
        });

        it('should keep an opted-out field exact', () => {
            const config = serialize(eq('address', 'Hogwarts'), { filters: { caseSensitive: ['address'] } });

            expect(config.where).toEqual({ address: { eq: 'Hogwarts' } });
        });

        it('should complement ne with a null arm', () => {
            expect(serialize(ne('address', 'Hogwarts')).where).toEqual({
                OR: [
                    { address: { notIlike: 'Hogwarts' } },
                    { address: { isNull: true } },
                ],
            });
        });

        it('should drop the null arm on a non-nullable column', () => {
            expect(serialize(ne('first_name', 'Caleb')).where).toEqual({ first_name: { notIlike: 'Caleb' } });
        });

        it('should render a null comparison as a null check', () => {
            expect(serialize(eq('address', null)).where).toEqual({ address: { isNull: true } });
            expect(serialize(ne('address', null)).where).toEqual({ address: { isNotNull: true } });
        });
    });

    describe('ordering family', () => {
        it('should map ordering operators one to one', () => {
            expect(serialize(lt('age', 40)).where).toEqual({ age: { lt: 40 } });
            expect(serialize(gte('age', 18)).where).toEqual({ age: { gte: 18 } });
        });

        it('should complement a negated ordering through the dual operator', () => {
            // the null arm dies on the non-nullable column.
            expect(serialize(not(gte('age', 18))).where).toEqual({ age: { lt: 18 } });
        });
    });

    describe('membership', () => {
        it('should decompose an insensitive membership into ilike arms', () => {
            expect(serialize(inArray('address', ['Hogwarts', 'Mordor'])).where).toEqual({
                OR: [
                    { address: { ilike: 'Hogwarts' } },
                    { address: { ilike: 'Mordor' } },
                ],
            });
        });

        it('should keep non-string members an exact membership test', () => {
            expect(serialize(inArray('age', [18, 33])).where).toEqual({ age: { in: [18, 33] } });
        });

        it('should widen a null member to a null check', () => {
            expect(serialize(inArray('address', ['Hogwarts', null])).where).toEqual({
                OR: [
                    { address: { ilike: 'Hogwarts' } },
                    { address: { isNull: true } },
                ],
            });
        });

        it('should complement nin as notIlike arms plus the null arm', () => {
            expect(serialize(nin('address', ['Hogwarts', 'Mordor'])).where).toEqual({
                OR: [
                    {
                        AND: [
                            { address: { notIlike: 'Hogwarts' } },
                            { address: { notIlike: 'Mordor' } },
                        ],
                    },
                    { address: { isNull: true } },
                ],
            });
        });

        it('should complement a null member with a not-null guard', () => {
            expect(serialize(nin('address', ['Hogwarts', null])).where).toEqual({
                AND: [
                    { address: { notIlike: 'Hogwarts' } },
                    { address: { isNotNull: true } },
                ],
            });
        });
    });

    describe('anchored operators', () => {
        it('should derive escaped ilike patterns', () => {
            expect(serialize(contains('address', 'wart')).where).toEqual({ address: { ilike: '%wart%' } });
            expect(serialize(startsWith('address', 'Hog')).where).toEqual({ address: { ilike: 'Hog%' } });
            expect(serialize(contains('address', '50%')).where).toEqual({ address: { ilike: '%50\\%%' } });
        });

        it('should complement a negated anchor with the null arm', () => {
            expect(serialize(notContains('address', 'wart')).where).toEqual({
                OR: [
                    { address: { notIlike: '%wart%' } },
                    { address: { isNull: true } },
                ],
            });
        });
    });

    describe('relations', () => {
        it('should nest a to-one path', () => {
            expect(serialize(eq('realm.name', 'master')).where).toEqual({ realm: { name: { ilike: 'master' } } });
        });

        it('should add the absence arm to a to-one complement', () => {
            expect(serialize(ne('realm.name', 'master')).where).toEqual({
                OR: [
                    { realm: { name: { notIlike: 'master' } } },
                    { NOT: { realm: true } },
                ],
            });
        });

        it('should quantify a to-many path existentially', () => {
            expect(serialize(eq('items.title', 'book')).where).toEqual({ items: { title: { ilike: 'book' } } });
        });

        it('should factor same-path conjuncts into one scope', () => {
            const condition = and(
                eq('items.title', 'book'),
                eq('items.color', 'red'),
            );

            expect(serialize(condition).where).toEqual({
                items: {
                    AND: [
                        { title: { ilike: 'book' } },
                        { color: { ilike: 'red' } },
                    ],
                },
            });
        });

        it('should add the empty-collection arm to a to-many complement', () => {
            expect(serialize(ne('items.title', 'book')).where).toEqual({
                OR: [
                    { items: { title: { notIlike: 'book' } } },
                    { NOT: { items: true } },
                ],
            });
        });

        it('should render a relation null check as a presence test', () => {
            expect(serialize(exists('realm')).where).toEqual({ realm: true });
            expect(serialize(exists('realm', false)).where).toEqual({ NOT: { realm: true } });
        });

        it('should treat a to-many collection as always present', () => {
            // exists() asks for the value, and a collection is
            // possibly empty, never absent.
            const config = serialize(exists('items'));

            expect(config.where).toBeUndefined();
            expect(config.limit).toBeUndefined();

            const negated = serialize(exists('items', false));

            expect(negated.where).toBeUndefined();
            expect(negated.limit).toEqual(0);
        });
    });

    describe('elemMatch', () => {
        it('should map a to-many elemMatch onto one scope', () => {
            const condition = elemMatch('items', and(eq('title', 'book'), eq('color', 'red')));

            expect(serialize(condition).where).toEqual({
                items: {
                    AND: [
                        { title: { ilike: 'book' } },
                        { color: { ilike: 'red' } },
                    ],
                },
            });
        });

        it('should reject an elemMatch on a scalar column', () => {
            expect(() => serialize(elemMatch('address', eq('length', 1))))
                .toThrow(AdapterError);
        });

        it('should reject an elemMatch on a to-one relation', () => {
            expect(() => serialize(elemMatch('realm', eq('name', 'master'))))
                .toThrow(AdapterError);
        });
    });

    describe('unsupported operators', () => {
        it('should reject regex, mod and size typed', () => {
            expect(() => serialize(regex('address', /wart/))).toThrow(AdapterError);
            expect(() => serialize(mod('age', 3, 1))).toThrow(AdapterError);
            expect(() => serialize(size('items', 2))).toThrow(AdapterError);
        });
    });

    describe('expansion limit', () => {
        it('should fail typed instead of downgrading a huge mixed tree', () => {
            const conditions : Condition[] = [];
            for (let i = 0; i < 7; i++) {
                conditions.push(or(eq('items.title', `title-${i}`), eq('age', i)));
            }

            expect(() => serialize(and(...conditions))).toThrow(AdapterError);
        });
    });

    describe('dialect presets', () => {
        it('should fall back to like on sqlite and mysql', () => {
            const sqlite = serialize(contains('address', 'wart'), { provider: 'sqlite' });
            expect(sqlite.where).toEqual({ address: { like: '%wart%' } });

            const mysql = serialize(eq('address', 'Hogwarts'), { provider: 'mysql' });
            expect(mysql.where).toEqual({ address: { eq: 'Hogwarts' } });
        });

        it('should escape LIKE operands on mysql', () => {
            expect(serialize(contains('address', '50%'), { provider: 'mysql' }).where).toEqual({ address: { like: '%50\\%%' } });
        });

        it('should reject an inexpressible literal wildcard on sqlite', () => {
            expect(() => serialize(contains('address', '50%'), { provider: 'sqlite' }))
                .toThrow(AdapterError);
        });

        it('should reject an unknown dialect name', () => {
            expect(() => serialize(eq('age', 1), { provider: 'oracle' }))
                .toThrow(AdapterError);
        });

        it('should reject an inherited object member as a dialect name', () => {
            // `valueOf` resolves through Object.prototype on a naive
            // lookup and would pose as a preset.
            expect(() => serialize(eq('age', 1), { provider: 'valueOf' }))
                .toThrow(AdapterError);
        });
    });
});
