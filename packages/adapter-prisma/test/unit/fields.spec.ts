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
    eq,
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

    it('should narrow an included relation to its direct field picks (#847)', () => {
        // revised projection contract (#847), shared with @rapiq/adapter-memory and
        // @rapiq/adapter-typeorm: a per-relation fieldset governs the projection of
        // an included relation; only a pick-free include hydrates whole.
        expect(build(['id', 'realm.name'], ['realm'])).toEqual({ select: { id: true, realm: { select: { name: true } } } });
    });

    it('should keep an included relation whole when only a deeper relation is picked (#847)', () => {
        // a pick belongs to the relation that owns the column: `items.realm.id`
        // narrows `items.realm`, never the traversed prefix `items`.
        expect(build(['id', 'items.realm.id'], ['items'])).toEqual({
            select: {
                id: true,
                items: { include: { realm: { select: { id: true } } } },
            },
        });
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

    const buildGated = (fields: Field[], relations: string[] = []) => {
        const adapter = new PrismaAdapter(createAdapterOptions());

        const { args } = adapter.execute(new Query({
            fields: new Fields(fields),
            relations: new Relations(relations.map((relation) => new Relation(relation))),
        }));

        return args;
    };

    it('should force-project the operand a visibility gate reads (#830)', () => {
        // the gate is enforced post-fetch (applyFieldConditions); a missing
        // operand would over-redact an eq-gate and let a negated gate disclose.
        expect(buildGated([
            new Field('id'),
            new Field('email', undefined, eq('age', 60)),
        ])).toEqual({
            select: {
                id: true, 
                email: true, 
                age: true, 
            }, 
        });
    });

    it('should keep a forced operand selected under a narrowed include (#847)', () => {
        // the `realm.id` pick narrows the include; the gate operand
        // `realm.name` rides along without widening the narrowing back up.
        expect(buildGated([
            new Field('id'),
            new Field('realm.id'),
            new Field('email', undefined, eq('realm.name', 'master')),
        ], ['realm'])).toEqual({
            select: {
                id: true,
                email: true,
                realm: { select: { id: true, name: true } },
            },
        });
    });

    it('should leave a pick-free whole include covering its operands (#830/#847)', () => {
        // no direct pick: the include hydrates whole, which already fetches
        // the operand — the forced entry must not narrow the relation.
        expect(buildGated([
            new Field('id'),
            new Field('email', undefined, eq('realm.name', 'master')),
        ], ['realm'])).toEqual({
            select: {
                id: true, 
                email: true, 
                realm: true, 
            }, 
        });
    });
});
