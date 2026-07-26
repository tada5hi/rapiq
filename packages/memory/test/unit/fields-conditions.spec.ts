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
    and,
    eq,
} from '@rapiq/core';
import {
    applyFieldConditions,
    applyQuery,
    compileFieldConditions,
    compileFields,
} from '../../src';

const records = [
    {
        id: 1,
        name: 'first',
        kind: 'public',
        secret: 'visible',
    },
    {
        id: 2,
        name: 'second',
        kind: 'private',
        secret: 'hidden',
    },
];

describe('fields visibility gates', () => {
    it('should omit a gated field on a failing record and keep it on a passing one', () => {
        const projector = compileFields(new Fields([
            new Field('id'),
            new Field('secret', undefined, eq('kind', 'public')),
        ]));

        expect(projector(records[0] as any)).toEqual({ id: 1, secret: 'visible' });
        expect(projector(records[1] as any)).toEqual({ id: 2 });
    });

    it('should evaluate a gate against a property the selection drops', () => {
        // the gate runs before the projection, so its own field
        // does not need to be part of the selection.
        const projector = compileFields(new Fields([
            new Field('secret', undefined, eq('kind', 'public')),
        ]));

        expect(projector(records[0] as any)).toEqual({ secret: 'visible' });
        expect(projector(records[1] as any)).toEqual({});
    });

    it('should leave ungated fields untouched', () => {
        const projector = compileFields(new Fields([
            new Field('id'),
            new Field('name'),
            new Field('secret', undefined, eq('kind', 'public')),
        ]));

        expect(projector(records[1] as any)).toEqual({ id: 2, name: 'second' });
    });

    it('should return the record by reference when no field is gated', () => {
        const projector = compileFields(new Fields([
            new Field('name', FieldOperator.EXCLUDE),
        ]));

        expect(projector(records[0] as any)).toBe(records[0]);
    });

    it('should honour a gate without any pick', () => {
        const projector = compileFields(new Fields([
            new Field('secret', FieldOperator.EXCLUDE, eq('kind', 'public')),
        ]));

        expect(projector(records[0] as any)).toBe(records[0]);
        expect(projector(records[1] as any)).toEqual({
            id: 2,
            name: 'second',
            kind: 'private',
        });
    });

    it('should support compound gate conditions', () => {
        const projector = compileFields(new Fields([
            new Field('secret', undefined, and(eq('kind', 'public'), eq('name', 'first'))),
        ]));

        expect(projector(records[0] as any)).toEqual({ secret: 'visible' });
        expect(projector({ ...records[0], name: 'other' } as any)).toEqual({});
    });

    it('should never remove a record', () => {
        const query = new Query({
            fields: new Fields([
                new Field('id'),
                new Field('secret', undefined, eq('kind', 'public')),
            ]),
        });

        const output = applyQuery(query, records);

        expect(output.total).toEqual(2);
        expect(output.data).toEqual([
            { id: 1, secret: 'visible' },
            { id: 2 },
        ]);
    });
});

describe('fields visibility gates (relation paths)', () => {
    const user = {
        id: 1,
        realm: {
            id: 5,
            kind: 'private',
            secret: 'realm-secret',
        },
        items: [
            {
                id: 10,
                kind: 'public',
                secret: 'first-secret',
            },
            {
                id: 20,
                kind: 'private',
                secret: 'second-secret',
            },
        ],
    };

    it('should evaluate a gate against the related record', () => {
        // the condition's field names are relative to the record the
        // gated property is read from, not to the query root.
        const projector = compileFields(new Fields([
            new Field('id'),
            new Field('realm.id'),
            new Field('realm.secret', undefined, eq('kind', 'public')),
        ]));

        expect(projector(user as any)).toEqual({ id: 1, realm: { id: 5 } });

        const passing = { ...user, realm: { ...user.realm, kind: 'public' } };
        expect(projector(passing as any)).toEqual({
            id: 1,
            realm: { id: 5, secret: 'realm-secret' },
        });
    });

    it('should gate every element of a to-many relation on its own', () => {
        const projector = compileFields(new Fields([
            new Field('items.id'),
            new Field('items.secret', undefined, eq('kind', 'public')),
        ]));

        expect(projector(user as any)).toEqual({
            items: [
                { id: 10, secret: 'first-secret' },
                { id: 20 },
            ],
        });
    });

    it('should redact inside an included relation subtree', () => {
        // an included relation widens to its whole subtree, so the gate
        // must survive that widening.
        const projector = compileFields(new Fields([
            new Field('id'),
            new Field('items.secret', undefined, eq('kind', 'public')),
        ]), { relations: ['items'] });

        expect(projector(user as any)).toEqual({
            id: 1,
            items: [
                {
                    id: 10, 
                    kind: 'public', 
                    secret: 'first-secret', 
                },
                { id: 20, kind: 'private' },
            ],
        });
    });
});

describe('applyFieldConditions', () => {
    const fields = new Fields([
        new Field('id'),
        new Field('secret', undefined, eq('kind', 'public')),
    ]);

    it('should match the projector for every record', () => {
        const projector = compileFieldConditions(fields);

        expect(applyFieldConditions(fields, records)).toEqual([
            {
                id: 1, 
                name: 'first', 
                kind: 'public', 
                secret: 'visible', 
            },
            {
                id: 2, 
                name: 'second', 
                kind: 'private', 
            },
        ]);

        expect(applyFieldConditions(fields, records)).toEqual(
            records.map(projector),
        );
    });

    it('should agree with the fields projector on gated key survival', () => {
        const project = compileFields(fields);

        const redacted = applyFieldConditions(fields, records);

        for (const [i, record] of records.entries()) {
            expect(Object.hasOwn(redacted[i] as any, 'secret')).toEqual(
                Object.hasOwn(project(record as any) as any, 'secret'),
            );
        }
    });

    it('should not project, only redact', () => {
        // the SQL backends project the columns themselves; the helper
        // only strips the values a gate hides.
        const [first] = applyFieldConditions(fields, records);

        expect(first).toEqual(records[0]);
    });

    it('should never mutate the input', () => {
        const input = records.map((record) => ({ ...record }));
        const output = applyFieldConditions(fields, input);

        expect(input[1]).toHaveProperty('secret');
        expect(output[1]).not.toHaveProperty('secret');
        expect(output).not.toBe(input);
    });

    it('should pass through untouched records by reference', () => {
        const output = applyFieldConditions(fields, records);

        expect(output[0]).toBe(records[0]);
        expect(output[1]).not.toBe(records[1]);
    });

    it('should copy the array when no field is gated', () => {
        const output = applyFieldConditions(new Fields([new Field('id')]), records);

        expect(output).toEqual(records);
        expect(output).not.toBe(records);
        expect(output[0]).toBe(records[0]);
    });

    it('should redact relation paths on fetched rows', () => {
        const relationFields = new Fields([
            new Field('items.secret', undefined, and(eq('kind', 'public'))),
        ]);

        const rows = [
            {
                id: 1,
                items: [
                    {
                        id: 10, 
                        kind: 'public', 
                        secret: 'a', 
                    },
                    {
                        id: 20, 
                        kind: 'private', 
                        secret: 'b', 
                    },
                ],
            },
        ];

        expect(applyFieldConditions(relationFields, rows)).toEqual([
            {
                id: 1,
                items: [
                    {
                        id: 10, 
                        kind: 'public', 
                        secret: 'a', 
                    },
                    { id: 20, kind: 'private' },
                ],
            },
        ]);
    });

    it('should keep a parent-level deletion when a nested gate also redacts', () => {
        // regression: the children pass descended via the INPUT, so a deeper
        // redaction resurrected a property this level's own gate had removed.
        const fields = new Fields([
            new Field('client', undefined, eq('visible', true)),
            new Field('client.secret', undefined, eq('admin', true)),
        ]);

        const rows = [
            {
                id: 1,
                visible: false,
                client: {
                    secret: 'top',
                    admin: false,
                },
            },
            {
                id: 2,
                visible: false,
                client: {
                    secret: 'top',
                    admin: true,
                },
            },
        ];

        expect(applyFieldConditions(fields, rows)).toEqual([
            { id: 1, visible: false },
            { id: 2, visible: false },
        ]);
    });

    it('should preserve the prototype of a redacted row', () => {
        class UserEntity {
            id : number;

            email : string;

            role : string;

            constructor(id: number, email: string, role: string) {
                this.id = id;
                this.email = email;
                this.role = role;
            }

            get display() {
                return `#${this.id}`;
            }
        }

        const fields = new Fields([
            new Field('email', undefined, eq('role', 'admin')),
        ]);

        const [redacted] = applyFieldConditions(fields, [
            new UserEntity(1, 'a@b.c', 'user'),
        ]);

        expect(redacted).toBeInstanceOf(UserEntity);
        expect(redacted).not.toHaveProperty('email');
        expect((redacted as UserEntity).display).toEqual('#1');
    });
});
