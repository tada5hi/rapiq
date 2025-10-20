/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter, Filters } from 'rapiq';
import {
    FiltersAdapter, type FiltersContainerOptions, RelationsAdapter, and, eq, nin, pg, within,
} from '../../../src';
import { FiltersInterpreter } from '../../../src/interpreter';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('in (within, nin)', () => {
    const relationsAdapter = new RelationsAdapter();
    const adapter = new FiltersAdapter(
        relationsAdapter,
        options,
    );
    const interpreter = new FiltersInterpreter({
        interpreters: {
            within, nin, and, eq,
        },
    });

    it('generates a separate placeholder for every element in the array', () => {
        const condition = new Filter('within', 'age', [1, 2]);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} in($1, $2)`);
        expect(params).toStrictEqual(condition.value);
    });

    it('correctly generates placeholders when combined with other operators', () => {
        const condition = new Filters('and', [
            new Filter('eq', 'name', 'John'),
            new Filter('within', 'age', [1, 2]),
        ]);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('("name" = $1 and "age" in($2, $3))');
        expect(params).toStrictEqual(['John', 1, 2]);
    });

    it('generates `not in` operator for "nin', () => {
        const condition = new Filter('nin', 'age', [1, 2]);
        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} not in($1, $2)`);
        expect(params).toStrictEqual(condition.value);
    });
});
