/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter } from 'rapiq';
import {
    FiltersAdapter, type FiltersContainerOptions, FiltersVisitor, RelationsAdapter, pg,
} from '../../../src';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('primitive operators', () => {
    let adapter : FiltersAdapter;
    let visitor : FiltersVisitor;

    beforeEach(() => {
        const relationsAdapter = new RelationsAdapter();
        adapter = new FiltersAdapter(
            relationsAdapter,
            options,
        );

        visitor = new FiltersVisitor(adapter);
    });

    it('generates query with `=` operator for "eq"', () => {
        const condition = new Filter('eq', 'name', 'test');
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} = $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates query with `<>` operator for "ne"', () => {
        const condition = new Filter('ne', 'name', 'test');
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} <> $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates query with `<` operator for "lt"', () => {
        const condition = new Filter('lt', 'age', 10);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} < $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates query with `<=` operator for "lte"', () => {
        const condition = new Filter('lte', 'age', 10);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} <= $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates query with `>` operator for "gt"', () => {
        const condition = new Filter('gt', 'age', 10);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} > $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates query with `>=` operator for "gte"', () => {
        const condition = new Filter('gte', 'age', 10);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} >= $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates call to `MOD` function for "mod"', () => {
        const condition = new Filter('mod', 'qty', [4, 0]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('mod("qty", $1) = $2');
        expect(params).toStrictEqual([4, 0]);
    });
});
