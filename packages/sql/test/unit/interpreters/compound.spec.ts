/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter, Filters } from 'rapiq';
import {
    FiltersAdapter, type FiltersContainerOptions, RelationsAdapter, and, eq, gt, lt, nor, not, or,
    pg,
} from '../../../src';
import { FiltersInterpreter } from '../../../src';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('compound operators', () => {
    const relationsAdapter = new RelationsAdapter();
    const adapter = new FiltersAdapter(
        relationsAdapter,
        options,
    );
    const interpreter = new FiltersInterpreter({
        interpreters: {
            or, nor, not, and, eq, lt, gt,
        },
    });

    it('generates query with inverted condition for "not"', () => {
        const condition = new Filters('not', [
            new Filters('or', [
                new Filter('eq', 'age', 12),
                new Filter('eq', 'age', 13),
            ]),
        ]);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('not ("age" = $1 or "age" = $2)');
        expect([12, 13]).toStrictEqual(params);
    });

    it('generates query combined by logical `and` for "and"', () => {
        const condition = new Filters(
            'and',
            [
                new Filter('eq', 'age', 1),
                new Filter('eq', 'active', true),
            ],
        );
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('("age" = $1 and "active" = $2)');
        expect(params).toStrictEqual([1, true]);
    });

    it('generates query combined by logical `or` for "or"', () => {
        const condition = new Filters('or', [
            new Filter('eq', 'age', 1),
            new Filter('eq', 'active', true),
        ]);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('("age" = $1 or "active" = $2)');
        expect(params).toStrictEqual([1, true]);
    });

    it('generates inverted query combined by logical `or` for "nor"', () => {
        const condition = new Filters('nor', [
            new Filter('eq', 'age', 1),
            new Filter('eq', 'active', true),
        ]);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('not ("age" = $1 or "active" = $2)');
        expect(params).toStrictEqual([1, true]);
    });

    it('properly adds brackets for complex compound condition', () => {
        const condition = new Filters('or', [
            new Filters('or', [
                new Filter('eq', 'age', 1),
                new Filter('eq', 'age', 2),
            ]),
            new Filters('and', [
                new Filter('gt', 'qty', 1),
                new Filter('lt', 'qty', 20),
            ]),
            new Filters('nor', [
                new Filter('gt', 'qty', 10),
                new Filter('lt', 'qty', 20),
            ]),
            new Filters('not', [new Filters('and', [
                new Filter('eq', 'active', false),
                new Filter('gt', 'age', 18),
            ])]),
        ]);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual([
            '("age" = $1 or "age" = $2)',
            'or ("qty" > $3 and "qty" < $4)',
            'or not ("qty" > $5 or "qty" < $6)',
            'or not ("active" = $7 and "age" > $8)',
        ].join(' '));
        expect(params).toStrictEqual([1, 2, 1, 20, 10, 20, false, 18]);
    });
});
