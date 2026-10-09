/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '@rapiq/core';
import {
    Field,
    Fields,
    Query,
    Relation,
    Relations,
    and,
    elemMatch,
    eq,
    gte,
    ne,
    not,
} from '@rapiq/core';
import { Adapter, pg } from '../../src';

/**
 * A `Field.condition` gates the VALUE of a column on the rows that satisfy it
 * (see rapiq#830). A SQL selection has to stay a bare column reference for a
 * backend to hydrate entities from it, so there is nowhere to put the gate in
 * the statement: this adapter projects the column unconditionally and the gate
 * is applied after the fetch, by the consumer.
 *
 * That makes the guarantee FAIL-OPEN here, which is exactly why it is pinned:
 * the gated column must appear in the select list unchanged, and the condition
 * must never leak into `where` and quietly turn a projection rule into a row
 * filter. Both directions are regressions worth catching.
 *
 * The post-fetch gate reads its operands from the fetched row, so the adapter
 * force-projects every leaf column a condition references: under a sparse
 * fieldset a missing operand would over-redact an eq-style gate and let a
 * negated gate disclose (negations match missing operands).
 */
describe('src/adapter/module.ts (field visibility gates)', () => {
    const dialect = { ...pg, rootAlias: 'user' };

    it('should project a gated column unchanged', () => {
        const fragments = new Adapter(dialect).execute(new Query({
            fields: new Fields([
                new Field('id'),
                new Field('secret', undefined, eq('realm_id', 'abc')),
            ]),
        }));

        expect(fragments.columns).toEqual([
            '"user"."id"',
            '"user"."secret"',
            '"user"."realm_id"',
        ]);
    });

    it('should not lower a gate into the where clause', () => {
        const fragments = new Adapter(dialect).execute(new Query({
            fields: new Fields([
                new Field('secret', undefined, eq('realm_id', 'abc')),
            ]),
        }));

        // the gate constrains a value, never the row set
        expect(fragments.where).toBe('');
        expect(fragments.params).toEqual([]);
    });

    it('should project the operand of a gate (docs recipe)', () => {
        const fragments = new Adapter(dialect).execute(new Query({
            fields: new Fields([
                new Field('id'),
                new Field('name'),
                new Field('email', undefined, eq('realm_id', 'x')),
            ]),
        }));

        expect(fragments.columns).toEqual([
            '"user"."id"',
            '"user"."name"',
            '"user"."email"',
            '"user"."realm_id"',
        ]);
    });

    it('should project every operand of a compound gate', () => {
        const fragments = new Adapter(dialect).execute(new Query({
            fields: new Fields([
                new Field('id'),
                new Field('email', undefined, and(
                    eq('realm_id', 'x'),
                    gte('age', 18),
                )),
            ]),
        }));

        expect(fragments.columns).toEqual([
            '"user"."id"',
            '"user"."email"',
            '"user"."realm_id"',
            '"user"."age"',
        ]);
    });

    it('should project the operand of a negated gate', () => {
        // a negated gate MATCHES a missing operand (complement law), so a
        // dropped operand would disclose the column on every row.
        const build = (condition: ICondition) => new Adapter(dialect)
            .execute(new Query({
                fields: new Fields([
                    new Field('id'),
                    new Field('email', undefined, condition),
                ]),
            }));

        const expected = ['"user"."id"', '"user"."email"', '"user"."realm_id"'];

        expect(build(ne('realm_id', 'abc')).columns).toEqual(expected);
        expect(build(not(eq('realm_id', 'abc'))).columns).toEqual(expected);
    });

    it('should prefix the operand of a gate on a relation-path field', () => {
        // the gate on `realm.name` is evaluated against the realm record,
        // so its operand `kind` reads the column `realm.kind`.
        const build = (condition?: ReturnType<typeof eq>) => new Adapter(dialect)
            .execute(new Query({
                fields: new Fields([new Field('realm.name', undefined, condition)]),
                relations: new Relations([new Relation('realm')]),
            }));

        expect(build(eq('kind', 'public')).columns).toEqual([
            ...build().columns,
            '"r5_realm"."kind"',
        ]);
    });

    it('should not duplicate an operand that is already selected', () => {
        const fragments = new Adapter(dialect).execute(new Query({
            fields: new Fields([
                new Field('id'),
                new Field('realm_id'),
                new Field('email', undefined, eq('realm_id', 'x')),
            ]),
        }));

        expect(fragments.columns).toEqual([
            '"user"."id"',
            '"user"."realm_id"',
            '"user"."email"',
        ]);
    });

    it('should project the array column of an elemMatch gate, not its interior', () => {
        const fragments = new Adapter(dialect).execute(new Query({
            fields: new Fields([
                new Field('id'),
                new Field('email', undefined, elemMatch('items', eq('kind', 'x'))),
            ]),
        }));

        // the interior operands are element-relative, never columns.
        expect(fragments.columns).toEqual([
            '"user"."id"',
            '"user"."email"',
            '"user"."items"',
        ]);
    });

    it('should render an ungated query byte-identically', () => {
        const fragments = new Adapter(dialect).execute(new Query({
            fields: new Fields([
                new Field('id'),
                new Field('name'),
            ]),
        }));

        expect(fragments.columns).toEqual(['"user"."id"', '"user"."name"']);
    });
});
