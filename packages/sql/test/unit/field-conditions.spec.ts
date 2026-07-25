/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Query,
    Relation,
    Relations,
    eq,
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

        expect(fragments.columns).toEqual(['"user"."id"', '"user"."secret"']);
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

    it('should render a gated column identically to an ungated one', () => {
        const build = (condition?: ReturnType<typeof eq>) => new Adapter(dialect)
            .execute(new Query({
                fields: new Fields([new Field('realm.name', undefined, condition)]),
                relations: new Relations([new Relation('realm')]),
            }));

        expect(build(eq('kind', 'public')).columns).toEqual(build().columns);
    });
});
