/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldCondition } from 'rapiq';
import {
    FiltersAdapter, type FiltersContainerOptions, RelationsAdapter, eq, gt, gte, lt, lte, mod, ne,
    pg,
} from '../../../src';
import { FiltersInterpreter } from '../../../src/interpreter';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('primitive operators', () => {
    const relationsAdapter = new RelationsAdapter();
    const adapter = new FiltersAdapter(
        relationsAdapter,
        options,
    );
    const interpreter = new FiltersInterpreter({
        interpreters: {
            eq, ne, lt, lte, gt, gte, mod,
        },
    });

    it('generates query with `=` operator for "eq"', () => {
        const condition = new FieldCondition('eq', 'name', 'test');
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} = $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates query with `<>` operator for "ne"', () => {
        const condition = new FieldCondition('ne', 'name', 'test');
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} <> $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates query with `<` operator for "lt"', () => {
        const condition = new FieldCondition('lt', 'age', 10);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} < $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates query with `<=` operator for "lte"', () => {
        const condition = new FieldCondition('lte', 'age', 10);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} <= $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates query with `>` operator for "gt"', () => {
        const condition = new FieldCondition('gt', 'age', 10);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} > $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates query with `>=` operator for "gte"', () => {
        const condition = new FieldCondition('gte', 'age', 10);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} >= $1`);
        expect(params).toStrictEqual([condition.value]);
    });

    it('generates call to `MOD` function for "mod"', () => {
        const condition = new FieldCondition('mod', 'qty', [4, 0]);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('mod("qty", $1) = $2');
        expect(params).toStrictEqual([4, 0]);
    });
});
