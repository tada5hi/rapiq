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
} from '@rapiq/core';
import { compileFields } from '../../src';

const user = {
    id: 1,
    name: 'Peter',
    email: 'peter@example.com',
    realm: {
        id: 5, 
        name: 'master', 
        secret: 'hidden', 
    },
    items: [
        {
            id: 10, 
            title: 'first', 
            price: 2, 
        },
        {
            id: 20, 
            title: 'second', 
            price: 3, 
        },
    ],
};

describe('fields projection', () => {
    it('should return the identity for empty fields', () => {
        const projector = compileFields(new Fields());

        expect(projector(user)).toBe(user);
    });

    it('should pick selected root fields', () => {
        const projector = compileFields(new Fields([
            new Field('id'),
            new Field('name'),
        ]));

        expect(projector(user)).toEqual({ id: 1, name: 'Peter' });
    });

    it('should keep include-flagged fields and drop exclude-flagged entries', () => {
        const projector = compileFields(new Fields([
            new Field('id'),
            new Field('email', FieldOperator.INCLUDE),
            new Field('name', FieldOperator.EXCLUDE),
        ]));

        expect(projector(user)).toEqual({ id: 1, email: 'peter@example.com' });
    });

    it('should return the identity when only excludes remain', () => {
        // subtract-from-default is resolved at parse time
        // (Fields.execute); the projector never subtracts.
        const projector = compileFields(new Fields([
            new Field('email', FieldOperator.EXCLUDE),
        ]));

        expect(projector(user)).toBe(user);
    });

    it('should project relation-path fields through arrays', () => {
        const projector = compileFields(new Fields([
            new Field('id'),
            new Field('items.title'),
        ]));

        expect(projector(user)).toEqual({
            id: 1,
            items: [{ title: 'first' }, { title: 'second' }],
        });
    });

    it('should project nested to-one paths', () => {
        const projector = compileFields(new Fields([
            new Field('realm.name'),
        ]));

        expect(projector(user)).toEqual({ realm: { name: 'master' } });
    });

    it('should omit absent picked properties', () => {
        const projector = compileFields(new Fields([
            new Field('id'),
            new Field('missing'),
        ]));

        expect(projector(user)).toEqual({ id: 1 });
    });

    it('should keep whole subtrees for included relations', () => {
        const projector = compileFields(new Fields([
            new Field('id'),
        ]), { relations: ['items'] });

        const output = projector(user);

        expect(output).toEqual({ id: 1, items: user.items });
        expect(output.items).toBe(user.items);
    });

    it('should widen refined relations to the whole subtree', () => {
        // an included relation contributes all of its columns,
        // even next to a sparse field selection (joinAndSelect parity).
        const projector = compileFields(new Fields([
            new Field('id'),
            new Field('realm.name'),
        ]), { relations: ['realm'] });

        expect(projector(user)).toEqual({ id: 1, realm: user.realm });
    });

    it('should let a whole-property pick win over a refinement', () => {
        const projector = compileFields(new Fields([
            new Field('realm'),
            new Field('realm.name'),
        ]));

        expect(projector(user)).toEqual({ realm: user.realm });
    });

    it('should pass through non-object inputs', () => {
        const projector = compileFields(new Fields([
            new Field('id'),
        ]));

        expect(projector(null as any)).toBeNull();
    });

    it('should preserve null relation values under a refinement pick', () => {
        const projector = compileFields(new Fields([
            new Field('realm.name'),
        ]));

        expect(projector({ realm: null } as any)).toEqual({ realm: null });
    });

    it('should not leak scalar values through a refinement pick', () => {
        const projector = compileFields(new Fields([
            new Field('realm.name'),
        ]));

        expect(projector({ realm: 'scalar' } as any)).toEqual({});

        const arrayProjector = compileFields(new Fields([
            new Field('items.title'),
        ]));

        expect(arrayProjector({ items: ['s1'] } as any)).toEqual({ items: [] });
    });
});
