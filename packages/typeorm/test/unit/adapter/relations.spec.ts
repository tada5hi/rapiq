/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Relation, Relations } from '@rapiq/core';
import { RelationsVisitor } from '@rapiq/sql';
import type { DataSource, SelectQueryBuilder } from 'typeorm';
import type { RelationsAdapterOptions } from '../../../src';
import { TypeormAdapter } from '../../../src';
import { User } from '../../data/entity/user';
import { createUnconnectedDataSource } from '../../data/factory';

describe('src/adapter/relations.ts', () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = await createUnconnectedDataSource();
    });

    const setup = (options?: RelationsAdapterOptions) => {
        const queryBuilder = dataSource
            .getRepository(User)
            .createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder, relations: options });

        return { queryBuilder, adapter };
    };

    const visit = (
        adapter: TypeormAdapter,
        ...relations: string[]
    ) => {
        const nodes = new Relations(relations.map((name) => new Relation(name)));
        nodes.accept(new RelationsVisitor(adapter.relations));
    };

    it('should left join by default', () => {
        const { queryBuilder, adapter } = setup();

        visit(adapter, 'realm');
        adapter.relations.execute();

        expect(queryBuilder.getSql()).toContain('LEFT JOIN');
        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(1);
    });

    it('should inner join on request', () => {
        const { queryBuilder, adapter } = setup({ joinType: 'inner' });

        visit(adapter, 'realm');
        adapter.relations.execute();

        expect(queryBuilder.getSql()).toContain('INNER JOIN');
    });

    it('should join and select on request', () => {
        const { queryBuilder, adapter } = setup({ joinAndSelect: true });

        visit(adapter, 'realm');
        adapter.relations.execute();

        expect(queryBuilder.getSql()).toContain('LEFT JOIN');
        expect(
            queryBuilder.expressionMap.selects.some(
                (select) => select.selection === 'realm',
            ),
        ).toBeTruthy();
    });

    it('should not join twice on repeated execution', () => {
        const { queryBuilder, adapter } = setup();

        visit(adapter, 'realm');
        adapter.relations.execute();
        adapter.relations.execute();

        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(1);
    });

    it('should skip pre-existing joins', () => {
        const { queryBuilder, adapter } = setup();
        queryBuilder.leftJoinAndSelect('user.realm', 'realm');

        visit(adapter, 'realm');
        adapter.relations.execute();

        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(1);
    });

    it('should join nested relation paths', () => {
        const { queryBuilder, adapter } = setup();

        // `detail` only exists on Role, not on User — resolvable
        // only when the walk descends into the related entity metadata.
        visit(adapter, 'role.detail');
        adapter.relations.execute();

        const joins = queryBuilder.expressionMap.joinAttributes.map(
            (join) => [join.entityOrProperty, join.alias.name],
        );
        expect(joins).toEqual([
            ['user.role', 'role'],
            ['role.detail', 'role_detail'],
        ]);
    });

    it('should join same-named relations on different branches distinctly', () => {
        const { queryBuilder, adapter } = setup();

        // both paths end in `realm` — leaf-based aliasing skipped the
        // second join and resolved every `*.realm.*` reference against
        // whichever join was applied first (#744).
        visit(adapter, 'realm', 'role.realm');
        adapter.relations.execute();

        const joins = queryBuilder.expressionMap.joinAttributes.map(
            (join) => [join.entityOrProperty, join.alias.name],
        );
        expect(joins).toEqual([
            ['user.realm', 'realm'],
            ['user.role', 'role'],
            ['role.realm', 'role_realm'],
        ]);
    });

    it('should derive join aliases via a custom function', () => {
        const { queryBuilder, adapter } = setup({ relationAlias: (path) => path.replace(/\./g, '__') });

        visit(adapter, 'role.realm');
        adapter.relations.execute();

        const aliases = queryBuilder.expressionMap.joinAttributes.map(
            (join) => join.alias.name,
        );
        expect(aliases).toEqual(['role', 'role__realm']);
    });

    it('should drop unknown relations', () => {
        const { queryBuilder, adapter } = setup();

        visit(adapter, 'nonexistent');
        adapter.relations.execute();

        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(0);
    });

    it('should invoke the onJoin hook per applied join', () => {
        const calls : [string, string][] = [];

        const { queryBuilder, adapter } = setup({
            onJoin: (path, alias, query: SelectQueryBuilder<any>) => {
                calls.push([path, alias]);
                query.addGroupBy(`${alias}.id`);
            },
        });

        visit(adapter, 'role.detail');
        adapter.relations.execute();

        expect(calls).toEqual([
            ['role', 'role'],
            ['role.detail', 'role_detail'],
        ]);
        expect(queryBuilder.getSql()).toContain('GROUP BY');
    });

    it('should not invoke the onJoin hook for skipped joins', () => {
        const calls : string[] = [];

        const { queryBuilder, adapter } = setup({
            onJoin: (path) => {
                calls.push(path);
            },
        });
        queryBuilder.leftJoin('user.realm', 'realm');

        visit(adapter, 'realm');
        adapter.relations.execute();

        expect(calls).toHaveLength(0);
    });
});
