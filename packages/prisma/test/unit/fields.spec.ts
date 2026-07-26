/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    FieldOperator,
    Fields,
    Query,
    Relation,
    Relations,
} from '@rapiq/core';
import { createAdapterOptions } from '../data/schema';
import { PrismaAdapter } from '../../src';

function build(fields: string[] = [], relations: string[] = []) {
    const adapter = new PrismaAdapter(createAdapterOptions());

    const { args } = adapter.execute(new Query({
        fields: new Fields(fields.map((field) => {
            if (field.startsWith('-')) {
                return new Field(field.substring(1), FieldOperator.EXCLUDE);
            }

            return new Field(field);
        })),
        relations: new Relations(relations.map((relation) => new Relation(relation))),
    }));

    return args;
}

describe('src/adapter/fields.ts', () => {
    it('should emit nothing without fields or relations', () => {
        expect(build()).toEqual({});
    });

    it('should project picked fields with select', () => {
        expect(build(['id', 'first_name'])).toEqual({ select: { id: true, first_name: true } });
    });

    it('should drop excluded fields instead of emitting omit', () => {
        // prisma rejects select together with omit; an excluded field is
        // simply not projected, as on every other rapiq backend.
        expect(build(['id', '-email'])).toEqual({ select: { id: true } });
    });

    it('should hydrate relations with include', () => {
        expect(build([], ['realm'])).toEqual({ include: { realm: true } });
    });

    it('should nest a relation chain', () => {
        expect(build([], ['realm', 'items'])).toEqual({ include: { realm: true, items: true } });
    });

    it('should nest a dotted relation path', () => {
        expect(build([], ['items.realm'])).toEqual({ include: { items: { include: { realm: true } } } });
    });

    it('should switch to select once a field is picked', () => {
        // select and include are mutually exclusive per level, so an
        // included relation joins the select tree.
        expect(build(['id'], ['realm'])).toEqual({ select: { id: true, realm: true } });
    });

    it('should keep an included relation whole despite a sparse pick', () => {
        // relations widen a sparse field selection: the projection
        // contract shared with @rapiq/memory.
        expect(build(['id', 'realm.name'], ['realm'])).toEqual({ select: { id: true, realm: true } });
    });

    it('should project a relation sparsely when it is not included', () => {
        expect(build(['id', 'realm.name'])).toEqual({ select: { id: true, realm: { select: { name: true } } } });
    });

    it('should keep deeper relations of a wholly hydrated one', () => {
        expect(build(['id'], ['items', 'items.realm'])).toEqual({
            select: {
                id: true,
                items: { include: { realm: true } },
            },
        });
    });

    it('should project through a relation without root picks', () => {
        expect(build(['realm.name'])).toEqual({ select: { realm: { select: { name: true } } } });
    });
});
